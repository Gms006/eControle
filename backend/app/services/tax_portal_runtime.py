from __future__ import annotations

import base64
import logging
import re
import time
import unicodedata
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

import requests
from playwright.async_api import Page, async_playwright, expect

from app.core.config import settings


logger = logging.getLogger(__name__)

PORTAL_URL = "https://portaldocidadao.anapolis.go.gov.br/"

MAPEAMENTO_TAXAS = {
    "Taxa de Fiscalização de Funcionamento": "TAXA FUNCIONAMENTO",
    "Taxa de Fiscalização de Meios de Publicidade em Geral": "TAXA PUBLICIDADE",
    "ISS": "ISS",
    "Taxa de Vigilância Sanitária": "TAXA VIG SANITÁRIA",
    "Taxa de Fiscalização de Localização e Instalação": "TAXA LOCALIZ INSTALAÇÃO",
    "Preço Público Pela Ocupação e Uso de Área Pública": "TAXA OCUP ÁREA PÚBLICA",
}


def _norm(txt: str | None) -> str:
    if txt is None:
        return ""
    return (
        unicodedata.normalize("NFKD", str(txt))
        .encode("ASCII", "ignore")
        .decode()
        .upper()
        .strip()
    )


def format_cnpj_masked(cnpj: str) -> str:
    digits = re.sub(r"\D", "", str(cnpj or ""))
    if len(digits) != 14:
        return str(cnpj or "")
    return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"


def load_portal_credentials() -> tuple[str, str, str]:
    usuario = settings.PORTAL_CIDADAO_USUARIO
    senha = settings.PORTAL_CIDADAO_SENHA
    api_key = settings.API_KEY_2CAPTCHA
    if not usuario or not senha or not api_key:
        raise ValueError(
            "Configure PORTAL_CIDADAO_USUARIO, PORTAL_CIDADAO_SENHA e API_KEY_2CAPTCHA no .env"
        )
    return usuario, senha, api_key


def resolver_captcha_2captcha(image_base64: str, api_key: str) -> str:
    logger.info("Enviando captcha para resolução no 2CAPTCHA")
    response = requests.post(
        "http://2captcha.com/in.php",
        data={"method": "base64", "key": api_key, "body": image_base64, "json": 1},
        timeout=60,
    ).json()

    if response.get("status") != 1:
        raise RuntimeError(f"Erro ao enviar captcha: {response}")

    captcha_id = response["request"]

    for _ in range(20):
        time.sleep(5)
        result = requests.get(
            f"http://2captcha.com/res.php?key={api_key}&action=get&id={captcha_id}&json=1",
            timeout=60,
        ).json()
        if result.get("status") == 1:
            return result["request"]

    raise RuntimeError("Timeout na resolução do captcha")


def interpretar_parcelas(texto: str | None) -> str:
    if texto is None:
        return "Em Aberto"

    s = str(texto).strip().lower().replace(" ", "")
    if s in {"unica", "única", "0", "0,1"}:
        return "Em Aberto"

    m = re.fullmatch(r"(\d+)[aà](\d+)", s)
    if m:
        ini, fim = int(m.group(1)), int(m.group(2))
        if fim <= 0:
            return "Em Aberto"
        if ini < 0 or fim < ini:
            return "Em Aberto"
        total = fim
        # regra de negócio do portal:
        # "0a3" representa 3 parcelas em aberto -> 0/3
        abertas = fim if ini == 0 else (fim - ini + 1)
        pagas = max(total - abertas, 0)
        return f"{pagas}/{total}"

    if re.fullmatch(r"\d+(,\d+)*", s):
        nums = [int(x) for x in s.split(",")]
        if any(n <= 0 for n in nums):
            return "Em Aberto"
        total = max(nums)
        abertas = len(nums)
        pagas = max(total - abertas, 0)
        return f"{pagas}/{total}"

    if s.isdigit():
        n = int(s)
        if n <= 0:
            return "Em Aberto"
        return f"{max(n - 1, 0)}/{n}"

    return "Em Aberto"


def formatar_status_para_planilha(taxas: list[dict[str, Any]]) -> dict[str, str]:
    taxas_por_tipo: dict[str, list[dict[str, str]]] = {}

    for taxa in taxas:
        nome_taxa = taxa["nome"]
        resultado = taxa["resultado"]
        exercicio = taxa["exercicio"]

        tipo_taxa = None
        nome_norm = _norm(nome_taxa)
        for key, value in MAPEAMENTO_TAXAS.items():
            if _norm(key) in nome_norm:
                tipo_taxa = value
                break

        if not tipo_taxa:
            continue

        taxas_por_tipo.setdefault(tipo_taxa, []).append(
            {"exercicio": exercicio, "resultado": resultado}
        )

    resultado_final: dict[str, str] = {}
    for tipo_taxa, detalhes in taxas_por_tipo.items():
        if len(detalhes) == 1:
            resultado_final[tipo_taxa] = detalhes[0]["resultado"]
            continue

        exercicios = [
            int(d["exercicio"])
            for d in detalhes
            if d["exercicio"] and str(d["exercicio"]).isdigit()
        ]
        if not exercicios:
            resultado_final[tipo_taxa] = "Em Aberto"
            continue

        exercicios.sort()
        consecutivos = all(
            exercicios[i] + 1 == exercicios[i + 1]
            for i in range(len(exercicios) - 1)
        )
        if len(exercicios) > 1 and consecutivos:
            resultado_final[tipo_taxa] = f"{exercicios[0]} até {exercicios[-1]} em aberto"
        else:
            resultado_final[tipo_taxa] = "Vários exerc. em aberto"

    return resultado_final


@asynccontextmanager
async def open_tax_portal_page():
    launch_kwargs: dict[str, Any] = {"headless": settings.TAX_PORTAL_MODO_HEADLESS}
    if settings.TAX_PORTAL_EXECUTABLE_PATH:
        launch_kwargs["executable_path"] = settings.TAX_PORTAL_EXECUTABLE_PATH

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(**launch_kwargs)
        context = await browser.new_context(ignore_https_errors=True)
        page = await context.new_page()
        try:
            yield page
        finally:
            await context.close()
            await browser.close()


async def _captcha_invalido_na_pagina(page: Page) -> bool:
    candidatos = [
        page.locator("text=Informe ao valor da imagem gerada"),
        page.locator("text=Alertas"),
        page.locator("text=valor da imagem gerada"),
    ]
    for locator in candidatos:
        try:
            if await locator.first.is_visible():
                return True
        except Exception:
            pass
    return False


async def realizar_login(page: Page, usuario: str, senha: str, api_key: str) -> None:
    """Mantido o mais fiel possível ao script original, com retry de captcha inválido."""
    logger.info("[LOGIN] Acessando portal do cidadão...")
    await page.goto(PORTAL_URL)
    await page.fill('input[id="101817"]', usuario)
    await page.fill('input[id="101818"]', senha)

    async def _on_dialog(dialog):
        try:
            msg = (dialog.message or "").strip()
        except Exception:
            msg = ""
        logger.warning("[LOGIN] Dialog detectado no portal: %s", msg)
        await dialog.accept()

    page.on("dialog", _on_dialog)

    max_tentativas = int(getattr(settings, "TAX_PORTAL_MAX_TENTATIVAS_CAPTCHA", 3) or 3)

    if settings.TAX_PORTAL_MODO_TESTE:
        raise RuntimeError(
            "TAX_PORTAL_MODO_TESTE=true não é suportado no job do eControle. Use 2CAPTCHA."
        )

    for tentativa in range(1, max_tentativas + 1):
        captcha_bytes = await page.locator("img.step-img").screenshot()
        captcha_img = base64.b64encode(captcha_bytes).decode("utf-8")
        resposta = resolver_captcha_2captcha(captcha_img, api_key)
        logger.info("[LOGIN] Preenchendo captcha com resposta (tentativa %s/%s)", tentativa, max_tentativas)

        await page.fill('input[id="101819"]', "")
        await page.fill('input[id="101819"]', resposta)
        await page.click('input[id="101822"]')
        await page.wait_for_timeout(2500)

        if await _captcha_invalido_na_pagina(page):
            logger.warning("[LOGIN] Captcha inválido detectado. Tentando novamente...")
            try:
                ok_button = page.locator("button:has-text('OK'), input[value='OK'], .ui-dialog-buttonset button")
                if await ok_button.count() > 0:
                    await ok_button.first.click()
                    await page.wait_for_timeout(800)
            except Exception:
                pass

            if tentativa == max_tentativas:
                raise RuntimeError("Captcha rejeitado pelo portal após múltiplas tentativas")
            continue

        try:
            still_on_login = await page.locator('input[id="101819"]').is_visible()
        except Exception:
            still_on_login = False

        if still_on_login:
            if tentativa == max_tentativas:
                raise RuntimeError("Login não avançou após múltiplas tentativas de captcha")
            continue

        logger.info("[SUCESSO] Login realizado com sucesso")
        return

    raise RuntimeError("Falha inesperada no loop de login")


async def consultar_cnpj(page: Page, cnpj: str, idx: int, total: int) -> list[dict[str, Any]]:
    """Versão fiel ao script original."""
    try:
        logger.info("Consultando CNPJ %s (%s/%s)", cnpj, idx, total)

        await page.hover("a.pure-menu-link:text('Consultar')")
        await page.click("a[data-navigation='20206']")

        await page.wait_for_selector("input.tablesorter-filter[data-column='4']", timeout=10000)
        await page.fill("input.tablesorter-filter[data-column='4']", cnpj)
        await page.keyboard.press("Enter")

        await page.wait_for_selector("#grid67248")
        xpath = f"(//tr[td//div[contains(text(), '{cnpj}')]]//input[@type='radio'])[1]"
        checkbox = page.locator(xpath)

        try:
            await expect(checkbox).to_be_visible(timeout=10000)
        except Exception:
            logger.warning("Cliente não encontrado para o CNPJ %s", cnpj)
            return []

        await checkbox.check()

        await page.wait_for_selector('input[id="67252"]', timeout=10000)
        await page.click('input[id="67252"]')
        await page.wait_for_timeout(3000)

        if await page.locator("text=A inscrição informada não possui nenhum débito no momento").is_visible():
            logger.info("[SUCESSO] Cliente %s está regular - sem débitos", cnpj)
            return []

        return await extrair_taxas_detalhadas(page, cnpj)

    except Exception as exc:
        raise RuntimeError(f"consultar_cnpj::{cnpj} -> {exc}") from exc


async def extrair_taxas_detalhadas(page: Page, cnpj: str) -> list[dict[str, Any]]:
    """Mantém o fluxo do script original, mas clica no Detalhar do menu visível atual."""
    taxas_total: list[dict[str, Any]] = []

    try:
        engrenagens = await page.locator("button.nfe-action").all()

        if engrenagens:
            logger.info("Processando %s débitos encontrados", len(engrenagens))

        for idx, engrenagem in enumerate(engrenagens):
            logger.debug("Clicando em 'Detalhar' (%s/%s)...", idx + 1, len(engrenagens))

            await engrenagem.click()
            await page.wait_for_timeout(1000)

            try:
                # em vez de confiar em data-key=idx+1 ou buscar globalmente,
                # pega o menu visível aberto por esta engrenagem
                menu_visivel = page.locator(".fg-menu-container:visible").last
                await expect(menu_visivel).to_be_visible(timeout=5000)

                detalhar = menu_visivel.locator("a[data-op='DETALHA_DIVIDA']")
                await expect(detalhar.first).to_be_visible(timeout=5000)

                try:
                    await detalhar.first.click(timeout=5000)
                except Exception:
                    await detalhar.first.click(force=True, timeout=5000)

                await page.wait_for_timeout(1500)
                await page.wait_for_selector(
                    "table.jqgrid tbody tr.jqgrow",
                    state="visible",
                    timeout=20000,
                )

                taxas = await extrair_taxas(page)
                taxas_total.extend(taxas)

            except Exception as exc:
                logger.error("Erro ao processar engrenagem %s para %s: %s", idx + 1, cnpj, exc)
                continue

    except Exception as exc:
        raise RuntimeError(f"extrair_taxas_detalhadas::{cnpj} -> {exc}") from exc

    return taxas_total


async def extrair_taxas(page: Page) -> list[dict[str, Any]]:
    """Versão fiel ao script original."""
    await page.wait_for_selector("table.jqgrid tbody tr.jqgrow", timeout=10000)
    linhas = await page.locator("table.jqgrid tbody tr").all()
    exercicio_atual = None
    taxas_resultado: list[dict[str, Any]] = []

    for linha in linhas:
        classes = await linha.get_attribute("class") or ""
        if "jqgroup" in classes:
            texto = await linha.inner_text()
            if "Exercício:" in texto:
                exercicio_atual = texto.split("Exercício:")[-1].strip()
            continue

        if "jqgrow" not in classes:
            continue

        colunas = await linha.locator("td").all_text_contents()
        if len(colunas) < 6:
            continue

        nome_taxa = colunas[3].strip()
        parcelas = colunas[5].strip()

        if not nome_taxa or nome_taxa.startswith("R$") or not parcelas:
            continue

        status = interpretar_parcelas(parcelas)
        current_year = str(datetime.now().year)
        resultado = status
        if status == "Em Aberto" and exercicio_atual and exercicio_atual != current_year:
            resultado = f"{exercicio_atual} em aberto"

        taxas_resultado.append(
            {
                "exercicio": exercicio_atual,
                "nome": nome_taxa,
                "parcelas": parcelas,
                "resultado": resultado,
            }
        )

    if taxas_resultado:
        tipos_taxa = sorted({_norm(t["nome"]) for t in taxas_resultado})
        logger.info("Taxas lidas: %s", ", ".join(tipos_taxa[:6]))

    return taxas_resultado
