"""
Agente RFB local — consulta ao Cartão CNPJ da Receita Federal.

Fluxo:
  1. Backend chama GET http://localhost:8021/scrape/{cnpj}
  2. Agente abre Chromium (visível) com o CNPJ pré-preenchido na URL da RFB
  3. Usuário resolve o captcha e clica em "Consultar"
  4. Agente detecta a página de resultado, faz parse e devolve JSON no mesmo
     schema do endpoint /api/v1/lookups/receitaws/{cnpj}
  5. A aba do Chromium é fechada automaticamente

Pré-requisitos (instalar uma vez):
    pip install playwright fastapi uvicorn beautifulsoup4
    playwright install chromium

Uso:
    python scripts/rfb_agent.py
    # ou com porta customizada:
    RFB_AGENT_PORT=8022 python scripts/rfb_agent.py
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sys
import time
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any

import uvicorn
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException, status
from playwright.async_api import (
    TimeoutError as PlaywrightTimeoutError,
    async_playwright,
)

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

HOST = os.getenv("RFB_AGENT_HOST", "127.0.0.1")
PORT = int(os.getenv("RFB_AGENT_PORT", "8021"))
CAPTCHA_TIMEOUT_MS = int(os.getenv("RFB_AGENT_TIMEOUT_SECONDS", "300")) * 1000  # ms

_BROWSER_CONTEXT = None
_PLAYWRIGHT = None
_BROWSER_LOCK = asyncio.Lock()

RFB_BASE_URL = (
    "https://solucoes.receita.fazenda.gov.br"
    "/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp"
)
RESULT_URL_PATTERN = "**/Cnpjreva_Resultado*"
NAVIGATION_TIMEOUT_MS = int(os.getenv("RFB_AGENT_NAVIGATION_TIMEOUT_SECONDS", "30")) * 1000
RESULT_POLL_INTERVAL_MS = int(os.getenv("RFB_AGENT_RESULT_POLL_INTERVAL_MS", "1000"))

RFB_AGENT_BROWSER_CHANNEL = os.getenv("RFB_AGENT_BROWSER_CHANNEL", "chrome").strip() or None
RFB_AGENT_BROWSER_EXECUTABLE = os.getenv("RFB_AGENT_BROWSER_EXECUTABLE", "").strip() or None
RFB_AGENT_PROFILE_DIR = Path(
    os.getenv(
        "RFB_AGENT_PROFILE_DIR",
        str(Path.home() / ".econtrole-rfb-profile"),
    )
)
RFB_AGENT_DEBUG_DIR = Path(
    os.getenv(
        "RFB_AGENT_DEBUG_DIR",
        str(Path(__file__).resolve().parents[1] / "logs" / "rfb_agent"),
    )
)

RESULT_TEXT_MARKERS = (
    "COMPROVANTE DE INSCRICAO E DE SITUACAO CADASTRAL",
    "NUMERO DE INSCRICAO",
    "NOME EMPRESARIAL",
)

ERROR_TEXT_MARKERS = (
    "OS CARACTERES DA IMAGEM FORAM INFORMADOS INCORRETAMENTE",
    "OS CARACTERES ACIMA NAO FORAM PREENCHIDOS CORRETAMENTE",
    "VERIFIQUE SE O MESMO FOI DIGITADO CORRETAMENTE",
    "OCORREU UM ERRO",
    "TENTE NOVAMENTE",
    "NAO FOI POSSIVEL",
    "SERVICO INDISPONIVEL",
    "SISTEMA TEMPORARIAMENTE INDISPONIVEL",
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("rfb_agent")

# Garante que apenas uma consulta rode por vez (captcha é interativo)
_scrape_lock = asyncio.Lock()

app = FastAPI(title="eControle RFB Agent", version="1.0.0")


# ---------------------------------------------------------------------------
# Helpers de normalização (independentes do backend)
# ---------------------------------------------------------------------------


def _strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
    )


def _normalize_spaces(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = " ".join(value.split())
    return cleaned or None


def _normalize_title_case(value: str | None) -> str | None:
    text = _normalize_spaces(value)
    if not text:
        return None
    # Preposições e artigos em minúsculo
    lower_words = {"de", "da", "do", "das", "dos", "e", "em", "a", "o", "as", "os"}
    words = text.split()
    result = []
    for i, word in enumerate(words):
        if i == 0:
            result.append(word.capitalize())
        elif word.lower() in lower_words:
            result.append(word.lower())
        else:
            result.append(word.capitalize())
    return " ".join(result)


def _normalize_municipio(value: str | None) -> str | None:
    text = _normalize_spaces(value)
    if not text:
        return None
    return _normalize_title_case(text)


def _normalize_uf(value: str | None) -> str | None:
    text = _normalize_spaces(value)
    return text.upper() if text else None


def _normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    return digits if digits else None


def _normalize_email(value: str | None) -> str | None:
    text = _normalize_spaces(value)
    if not text or text == "-":
        return None
    return text.lower()


def _normalized_upper_text(value: str | None) -> str:
    return _strip_accents(_normalize_spaces(value) or "").upper()


def _short_text(value: str | None, max_len: int = 280) -> str:
    text = _normalize_spaces(value) or ""
    return text[:max_len] + ("..." if len(text) > max_len else "")


async def _safe_page_text(page) -> str:
    try:
        locator = page.locator("body")
        text = await locator.inner_text(timeout=2_000)
        return _normalize_spaces(text) or ""
    except Exception:
        return ""


async def _write_debug_artifacts(page, digits: str, reason: str) -> dict[str, str]:
    RFB_AGENT_DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_reason = re.sub(r"[^a-zA-Z0-9_-]+", "_", reason).strip("_") or "unknown"
    base = RFB_AGENT_DEBUG_DIR / f"{stamp}_{digits}_{safe_reason}"

    screenshot_path = str(base.with_suffix(".png"))
    html_path = str(base.with_suffix(".html"))
    meta_path = str(base.with_suffix(".json"))

    current_url = ""
    page_text = ""
    try:
        current_url = page.url or ""
    except Exception:
        current_url = ""

    try:
        page_text = await _safe_page_text(page)
    except Exception:
        page_text = ""

    try:
        await page.screenshot(path=screenshot_path, full_page=True)
    except Exception as exc:
        log.warning("Falha ao salvar screenshot de debug: %s", exc)
        screenshot_path = ""

    try:
        html = await page.content()
        Path(html_path).write_text(html, encoding="utf-8")
    except Exception as exc:
        log.warning("Falha ao salvar HTML de debug: %s", exc)
        html_path = ""

    try:
        Path(meta_path).write_text(
            json.dumps(
                {
                    "timestamp": stamp,
                    "cnpj": digits,
                    "reason": reason,
                    "url": current_url,
                    "body_excerpt": _short_text(page_text, 4000),
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
    except Exception as exc:
        log.warning("Falha ao salvar metadata de debug: %s", exc)
        meta_path = ""

    return {
        "screenshot": screenshot_path,
        "html": html_path,
        "meta": meta_path,
    }


async def _launch_browser_context(pw):
    RFB_AGENT_PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    common_kwargs = {
        "headless": False,
        "no_viewport": True,
        "args": [
            "--start-maximized",
            "--disable-blink-features=AutomationControlled",
        ],
    }

    preferred_kwargs = dict(common_kwargs)
    if RFB_AGENT_BROWSER_EXECUTABLE:
        preferred_kwargs["executable_path"] = RFB_AGENT_BROWSER_EXECUTABLE
    elif RFB_AGENT_BROWSER_CHANNEL:
        preferred_kwargs["channel"] = RFB_AGENT_BROWSER_CHANNEL

    try:
        if "channel" in preferred_kwargs or "executable_path" in preferred_kwargs:
            log.info(
                "Abrindo navegador preferencial (%s%s)...",
                f"channel={preferred_kwargs.get('channel')}" if preferred_kwargs.get("channel") else "",
                f", executable={preferred_kwargs.get('executable_path')}" if preferred_kwargs.get("executable_path") else "",
            )
        return await pw.chromium.launch_persistent_context(
            user_data_dir=str(RFB_AGENT_PROFILE_DIR),
            **preferred_kwargs,
        )
    except Exception as exc:
        log.warning("Falha ao abrir navegador preferencial. Fallback para Chromium padrão: %s", exc)
        return await pw.chromium.launch_persistent_context(
            user_data_dir=str(RFB_AGENT_PROFILE_DIR),
            **common_kwargs,
        )


async def _inspect_page_state(page) -> tuple[str, str]:
    current_url = ""
    try:
        current_url = page.url or ""
    except Exception:
        current_url = ""

    page_text = await _safe_page_text(page)
    normalized = _normalized_upper_text(page_text)

    if "CNPJREVA_RESULTADO" in _normalized_upper_text(current_url):
        return "result", "URL de resultado detectada."

    result_hits = sum(1 for marker in RESULT_TEXT_MARKERS if marker in normalized)
    if result_hits >= 2:
        return "result", "Marcadores textuais da página de resultado detectados."

    for marker in ERROR_TEXT_MARKERS:
        if marker in normalized:
            return "error", _short_text(page_text)

    return "pending", _short_text(page_text)


async def _wait_for_result_or_error(page, digits: str) -> str:
    deadline = time.monotonic() + (CAPTCHA_TIMEOUT_MS / 1000)
    last_excerpt = ""

    while time.monotonic() < deadline:
        if page.is_closed():
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="A janela da consulta RFB foi fechada antes da conclusão.",
            )

        state, info = await _inspect_page_state(page)
        last_excerpt = info or last_excerpt

        if state == "result":
            try:
                await page.wait_for_load_state("domcontentloaded", timeout=5_000)
            except Exception:
                pass

            try:
                await page.wait_for_load_state("networkidle", timeout=5_000)
            except Exception:
                pass

            return await page.content()

        if state == "error":
            artifacts = await _write_debug_artifacts(page, digits, "rfb_page_error")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "A RFB retornou uma mensagem de erro após a consulta. "
                    f"Trecho detectado: {info or 'sem detalhe textual'}. "
                    f"Debug: {artifacts.get('meta') or artifacts.get('html') or artifacts.get('screenshot')}"
                ),
            )

        await asyncio.sleep(RESULT_POLL_INTERVAL_MS / 1000)

    artifacts = await _write_debug_artifacts(page, digits, "rfb_timeout")
    raise HTTPException(
        status_code=status.HTTP_504_GATEWAY_TIMEOUT,
        detail=(
            "Timeout aguardando resultado da RFB. "
            f"Último trecho visível: {last_excerpt or 'sem conteúdo legível'}. "
            f"Debug: {artifacts.get('meta') or artifacts.get('html') or artifacts.get('screenshot')}"
        ),
    )
    
async def _get_or_create_browser_context():
    global _BROWSER_CONTEXT, _PLAYWRIGHT

    async with _BROWSER_LOCK:
        if _BROWSER_CONTEXT is not None:
            try:
                pages = _BROWSER_CONTEXT.pages
                _ = len(pages)
                return _BROWSER_CONTEXT
            except Exception:
                _BROWSER_CONTEXT = None

        if _PLAYWRIGHT is None:
            _PLAYWRIGHT = await async_playwright().start()

        _BROWSER_CONTEXT = await _launch_browser_context(_PLAYWRIGHT)
        return _BROWSER_CONTEXT

# ---------------------------------------------------------------------------
# Parser do cartão CNPJ da RFB
# ---------------------------------------------------------------------------


def _cell_lines(tag) -> list[str]:
    lines: list[str] = []
    for raw in tag.stripped_strings:
        text = _normalize_spaces(str(raw))
        if text:
            lines.append(text)
    return lines


def _label_matches(cell_text: str, *fragments: str) -> bool:
    """Verifica se o texto da célula contém algum dos fragmentos (case/accent-insensitive)."""
    normalized = _strip_accents(cell_text).upper()
    return any(_strip_accents(f).upper() in normalized for f in fragments)


def _is_known_label(text: str) -> bool:
    label_groups = [
        ("NOME EMPRESARIAL", "RAZAO SOCIAL"),
        ("TITULO DO ESTABELECIMENTO", "NOME DE FANTASIA", "NOME FANTASIA"),
        ("ATIVIDADE ECONOMICA PRINCIPAL", "ATIVIDADE PRINCIPAL"),
        ("ATIVIDADES ECONOMICAS SECUNDARIAS", "ATIVIDADES SECUNDARIAS"),
        ("NATUREZA JURIDICA",),
        ("LOGRADOURO",),
        ("NUMERO",),
        ("COMPLEMENTO",),
        ("CEP",),
        ("BAIRRO", "DISTRITO"),
        ("MUNICIPIO",),
        ("UF",),
        ("ENDERECO ELETRONICO", "EMAIL"),
        ("TELEFONE",),
        ("PORTE",),
        ("OPCAO PELO MEI", "OPTANTE MEI"),
        ("OPCAO PELO SIMPLES", "OPTANTE SIMPLES"),
    ]
    normalized = _strip_accents(_normalize_spaces(text) or "").upper()
    return any(
        any(_strip_accents(fragment).upper() in normalized for fragment in group)
        for group in label_groups
    )


def _canonical_cnae_code(raw_code: str) -> str:
    digits = re.sub(r"\D", "", raw_code or "")
    if len(digits) == 7:
        return f"{digits[:2]}.{digits[2:4]}-{digits[4]}-{digits[5:]}"
    return _normalize_spaces(raw_code) or ""


def _parse_cnae_cell(cell_text: str) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    if not cell_text or cell_text == "-":
        return entries

    parts = [p.strip(" -–") for p in re.split(r"[\r\n]+", cell_text) if p.strip()]
    if not parts:
        parts = [_normalize_spaces(cell_text) or ""]

    cnae_pattern = re.compile(
        r"^((?:\d{2}\.?\d{2}|\d{4})[-./\s]?\d[-./\s]?\d{2}|\d{7})\s*[-–]?\s*(.*)$"
    )

    for part in parts:
        match = cnae_pattern.match(part)
        if match:
            code = _canonical_cnae_code(match.group(1))
            text = _normalize_spaces(match.group(2)) or ""
            entries.append({"code": code, "text": text})
        else:
            text = _normalize_spaces(part)
            if text:
                entries.append({"code": "", "text": text})

    return entries


def parse_rfb_html(html: str, cnpj_digits: str) -> dict[str, Any]:
    """
    Faz parse do HTML da página de resultado do cartão CNPJ da RFB e devolve
    um dict no mesmo schema do endpoint /api/v1/lookups/receitaws/{cnpj}.
    """
    soup = BeautifulSoup(html, "html.parser")

    fields: dict[str, str] = {}
    cnae_principal_raw = ""
    cnaes_secundarios_raw = ""

    for row in soup.find_all("tr"):
        raw_cells = row.find_all(["td", "th"])
        if not raw_cells:
            continue

        cells: list[dict[str, str]] = []
        for cell in raw_cells:
            lines = _cell_lines(cell)
            if not lines:
                continue
            cells.append(
                {
                    "head": lines[0],
                    "tail": "\n".join(lines[1:]).strip(),
                    "full": "\n".join(lines).strip(),
                }
            )

        for idx, cell in enumerate(cells):
            label = cell["head"]
            value = cell["tail"]

            if not value and idx + 1 < len(cells):
                next_cell = cells[idx + 1]
                if not _is_known_label(next_cell["head"]):
                    value = next_cell["full"]

            if _label_matches(label, "NOME EMPRESARIAL", "RAZAO SOCIAL"):
                fields["razao_social"] = value
            elif _label_matches(label, "TITULO DO ESTABELECIMENTO", "NOME DE FANTASIA", "NOME FANTASIA"):
                fields["nome_fantasia"] = value
            elif _label_matches(label, "ATIVIDADE ECONOMICA PRINCIPAL", "ATIVIDADE PRINCIPAL"):
                cnae_principal_raw = value
            elif _label_matches(label, "ATIVIDADES ECONOMICAS SECUNDARIAS", "ATIVIDADES SECUNDARIAS"):
                cnaes_secundarios_raw = value
            elif _label_matches(label, "MUNICIPIO"):
                fields["municipio"] = value
            elif _label_matches(label, "UF"):
                fields["uf"] = value
            elif _label_matches(label, "TELEFONE") and "FAX" not in _strip_accents(label).upper():
                fields["telefone"] = value
            elif _label_matches(label, "ENDERECO ELETRONICO", "EMAIL"):
                fields["email"] = value
            elif _label_matches(label, "PORTE"):
                fields["porte"] = value
            elif _label_matches(label, "OPCAO PELO MEI", "OPTANTE MEI"):
                fields["mei"] = value
            elif _label_matches(label, "OPCAO PELO SIMPLES", "OPTANTE SIMPLES"):
                fields["simples"] = value

    if not fields.get("razao_social"):
        body_text = soup.get_text("\n", strip=True)
        match = re.search(r"NOME EMPRESARIAL\s*\n+(.+)", body_text, flags=re.IGNORECASE)
        if match:
            fields["razao_social"] = _normalize_spaces(match.group(1)) or ""

    cnaes_principal = _parse_cnae_cell(cnae_principal_raw)
    cnaes_secundarios = _parse_cnae_cell(cnaes_secundarios_raw)

    mei_text = _normalized_upper_text(fields.get("mei"))
    simei_optante = "SIM" in mei_text

    return {
        "cnpj": cnpj_digits,
        "razao_social": _normalize_title_case(fields.get("razao_social")),
        "nome_fantasia": _normalize_title_case(fields.get("nome_fantasia")),
        "porte": _normalize_spaces(fields.get("porte")),
        "municipio": _normalize_municipio(fields.get("municipio")),
        "municipio_padrao": _normalize_municipio(fields.get("municipio")),
        "uf": _normalize_uf(fields.get("uf")),
        "email": _normalize_email(fields.get("email")),
        "telefone": _normalize_phone(fields.get("telefone")),
        "simei_optante": simei_optante,
        "cnaes_principal": cnaes_principal,
        "cnaes_secundarios": cnaes_secundarios,
        "source": "RFB",
        "status": "success",
    }

# ---------------------------------------------------------------------------
# Endpoint de scraping
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "agent": "rfb_agent"}


@app.get("/scrape/{cnpj}")
async def scrape_cnpj(cnpj: str) -> dict[str, Any]:
    digits = re.sub(r"\D", "", cnpj)
    if len(digits) != 14:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CNPJ inválido — informe 14 dígitos.",
        )

    if _scrape_lock.locked():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já há uma consulta RFB em andamento. Aguarde e tente novamente.",
        )

    async with _scrape_lock:
        return await _do_scrape(digits)


async def _do_scrape(digits: str) -> dict[str, Any]:
    url = f"{RFB_BASE_URL}?cnpj={digits}"
    log.info("Abrindo navegador para CNPJ %s", digits)

    async with async_playwright() as pw:
        context = await _get_or_create_browser_context()
        page = await context.new_page()

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS)
            log.info(
                "Página carregada. Aguardando usuário resolver captcha e clicar em Consultar "
                "(timeout: %ds)...",
                CAPTCHA_TIMEOUT_MS // 1000,
            )

            html = await _wait_for_result_or_error(page, digits)
            log.info("Página de resultado detectada. Fazendo parse...")

        except HTTPException:
            raise
        except PlaywrightTimeoutError as exc:
            artifacts = await _write_debug_artifacts(page, digits, "playwright_timeout")
            log.error("Timeout durante scraping RFB: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=(
                    f"Timeout ou erro aguardando resultado da RFB: {exc}. "
                    f"Debug: {artifacts.get('meta') or artifacts.get('html') or artifacts.get('screenshot')}"
                ),
            )
        except Exception as exc:
            artifacts = await _write_debug_artifacts(page, digits, "unexpected_error")
            log.exception("Erro inesperado durante scraping RFB")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    f"Erro inesperado durante scraping RFB: {exc}. "
                    f"Debug: {artifacts.get('meta') or artifacts.get('html') or artifacts.get('screenshot')}"
                ),
            )
        finally:
            try:
                await page.close()
            except Exception:
                pass

    result = parse_rfb_html(html, digits)

    if not result.get("razao_social"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "A página retornou, mas o parse não encontrou Razão Social. "
                "Verifique os arquivos de debug do agente em backend/logs/rfb_agent."
            ),
        )

    log.info(
        "Parse concluído — razao_social=%r, CNAEs principal=%d, secundários=%d",
        result.get("razao_social"),
        len(result.get("cnaes_principal") or []),
        len(result.get("cnaes_secundarios") or []),
    )
    return result


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    log.info("eControle RFB Agent iniciando na porta %d", PORT)
    log.info("Endpoint: GET http://%s:%d/scrape/{cnpj}", HOST, PORT)
    log.info("Timeout do captcha: %ds", CAPTCHA_TIMEOUT_MS // 1000)
    log.info("Browser channel preferencial: %s", RFB_AGENT_BROWSER_CHANNEL or "chromium")
    log.info("Diretório de profile: %s", RFB_AGENT_PROFILE_DIR)
    log.info("Diretório de debug: %s", RFB_AGENT_DEBUG_DIR)

    uvicorn.run(app, host=HOST, port=PORT, log_level="info")