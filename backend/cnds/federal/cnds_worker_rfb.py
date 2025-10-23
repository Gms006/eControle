"""Worker Playwright para emissão da CND Federal (RFB)."""
from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Awaitable, Callable, Optional

from playwright.async_api import (
    TimeoutError as PlaywrightTimeoutError,
    Download,
    Page,
    Response,
    async_playwright,
)

URL_RFB = "https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj"
NAVIGATION_TIMEOUT_MS = 60_000
SELECTOR_TIMEOUT_MS = 30_000
DOWNLOAD_TIMEOUT_MS = 60_000
MAX_INITIAL_ATTEMPTS = 2

logger = logging.getLogger(__name__)

CND_DIR_BASE = Path(os.getenv("CND_DIR_BASE", "certidoes"))
CND_DIR_BASE.mkdir(parents=True, exist_ok=True)

CND_HEADLESS = (
    os.getenv("CND_HEADLESS", "true").strip().lower() in {"1", "true", "yes", "on"}
)
CND_CHROME_PATH = os.getenv("CND_CHROME_PATH") or None


def _only_digits(value: str) -> str:
    return re.sub(r"\D+", "", value or "")


def _build_filename() -> str:
    today = datetime.now().strftime("%d.%m.%Y")
    return f"CND Federal - {today}.pdf"


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


async def _fill_cnpj_input(page: Page, cnpj_digits: str) -> None:
    # monta máscara 00.000.000/0001-00
    cnpj_masked = f"{cnpj_digits[:2]}.{cnpj_digits[2:5]}.{cnpj_digits[5:8]}/{cnpj_digits[8:12]}-{cnpj_digits[12:]}"
    selectors = (
        'input[name="niContribuinte"]',
        'input[formcontrolname="niContribuinte"]',
        'input[id*="niContribuinte" i]',
    )
    target = None
    for s in selectors:
        loc = page.locator(s).first
        if await loc.count():
            try:
                await loc.wait_for(state="visible", timeout=SELECTOR_TIMEOUT_MS)
                target = loc
                break
            except Exception:
                continue
    if not target:
        raise RuntimeError("Campo de CNPJ não encontrado no portal da RFB.")

    await target.click()
    # Usa type com delay para acionar máscara e validadores
    try:
        await target.fill("")
    except Exception:
        pass
    await target.type(cnpj_masked, delay=60)  # simula digitação humana
    # força blur para o Angular validar
    await page.keyboard.press("Tab")
    # espera o formulário ficar válido
    await page.wait_for_function(
        """() => {
            const el = document.querySelector('input[name="niContribuinte"]') 
                      || document.querySelector('input[formcontrolname="niContribuinte"]');
            if (!el) return false;
            const form = el.closest('form');
            return form && form.classList.contains('ng-valid');
        }""",
        timeout=SELECTOR_TIMEOUT_MS,
    )
    await page.wait_for_timeout(300)


async def _click_consultar(page: Page) -> None:
    # primeiro botão (secondary)
    primeiro = page.locator(
        'button.br-button.secondary.btn-acao.btn-acao-3:has-text("Consultar Certidão"):not([disabled])'
    ).first
    if await primeiro.count():
        await primeiro.wait_for(state="visible", timeout=SELECTOR_TIMEOUT_MS)
        await primeiro.click(timeout=SELECTOR_TIMEOUT_MS)
        await page.wait_for_timeout(300)

    # segundo (submit)
    segundo = page.locator(
        'button.br-button.primary.btn-acao[type="submit"]:has-text("Consultar Certidão"):not([disabled])'
    ).first
    await segundo.wait_for(state="visible", timeout=SELECTOR_TIMEOUT_MS)
    await segundo.click(timeout=SELECTOR_TIMEOUT_MS)

    # espera angular/requests estabilizarem
    with contextlib.suppress(Exception):
        await page.wait_for_load_state("networkidle", timeout=NAVIGATION_TIMEOUT_MS)
    await page.wait_for_timeout(800)


async def _prepare_initial_consulta(page: Page, cnpj_digits: str) -> None:
    last_error: Optional[Exception] = None
    for attempt in range(1, MAX_INITIAL_ATTEMPTS + 1):
        try:
            logger.info(
                "[CND Federal] Acessando portal da RFB (tentativa %s/%s)",
                attempt,
                MAX_INITIAL_ATTEMPTS,
            )
            await page.goto(URL_RFB, wait_until="load", timeout=NAVIGATION_TIMEOUT_MS)
            await _fill_cnpj_input(page, cnpj_digits)
            await _click_consultar(page)
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            logger.warning(
                "[CND Federal] Falha na tentativa %s de consulta inicial: %s",
                attempt,
                exc,
            )
            with contextlib.suppress(Exception):
                await page.wait_for_timeout(1500)
    if last_error is not None:
        raise last_error
    raise RuntimeError("Falha desconhecida ao iniciar a consulta da CND Federal.")


async def _extract_validade(page: Page) -> tuple[Optional[str], Optional[date]]:
    script = """
        () => {
            const headers = Array.from(document.querySelectorAll('datatable-header-cell'));
            if (!headers.length) {
                return null;
            }
            let index = -1;
            headers.forEach((cell, idx) => {
                const text = (cell.textContent || '').toLowerCase();
                if (text.includes('data de validade')) {
                    index = idx;
                }
            });
            if (index < 0) {
                return null;
            }
            const row = document.querySelector('datatable-body-row');
            if (!row) {
                return null;
            }
            const cells = row.querySelectorAll('datatable-body-cell');
            const target = cells[index];
            if (!target) {
                return null;
            }
            const span = target.querySelector('.datatable-body-cell-label span[title]');
            if (span) {
                return span.getAttribute('title') || span.textContent || '';
            }
            const label = target.querySelector('.datatable-body-cell-label');
            if (label) {
                return label.textContent || '';
            }
            return target.textContent || '';
        }
    """
    try:
        raw_value = await page.evaluate(script)
    except Exception:
        return None, None

    if not raw_value:
        return None, None

    text = str(raw_value).strip()
    return text or None, _parse_date(text)


async def _capture_pdf(
    page: Page,
    trigger: Callable[[], Awaitable[object]],
    *,
    out_path: Path,
    timeout_ms: int,
    source_description: str,
) -> bool:
    loop = asyncio.get_running_loop()
    response_future: asyncio.Future[Response] = loop.create_future()

    def handle_response(response: Response) -> None:
        if response_future.done():
            return
        content_type = (response.headers.get("content-type") or "").lower()
        if "application/pdf" in content_type:
            response_future.set_result(response)

    page.on("response", handle_response)
    download_task = asyncio.create_task(
        page.wait_for_event("download", timeout=timeout_ms)
    )

    try:
        await trigger()
    except Exception:
        download_task.cancel()
        with contextlib.suppress(Exception):
            page.off("response", handle_response)
        raise

    download: Optional[Download] = None
    pdf_response: Optional[Response] = None

    try:
        done, pending = await asyncio.wait(
            {download_task, response_future},
            timeout=max(timeout_ms / 1000, 1),
            return_when=asyncio.FIRST_COMPLETED,
        )

        if download_task in done:
            try:
                download = await download_task
            except PlaywrightTimeoutError:
                download = None
            except Exception:
                download = None
        if response_future in done and response_future.done():
            try:
                pdf_response = response_future.result()
            except Exception:
                pdf_response = None

        for pending_task in pending:
            pending_task.cancel()
            with contextlib.suppress(Exception):
                await pending_task
    finally:
        if not response_future.done():
            response_future.cancel()
        with contextlib.suppress(Exception):
            page.off("response", handle_response)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        with contextlib.suppress(Exception):
            out_path.unlink()

    if download is not None:
        try:
            await download.save_as(str(out_path))
            logger.info(
                "[CND Federal] PDF salvo (%s) via evento de download (%s).",
                out_path,
                download.suggested_filename,
            )
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[CND Federal] Falha ao salvar download (%s): %s",
                source_description,
                exc,
            )

    if pdf_response is not None:
        try:
            content = await pdf_response.body()
            out_path.write_bytes(content)
            logger.info(
                "[CND Federal] PDF salvo (%s) a partir da resposta HTTP.",
                out_path,
            )
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[CND Federal] Falha ao salvar PDF da resposta (%s): %s",
                source_description,
                exc,
            )

    logger.warning(
        "[CND Federal] Nenhum PDF foi capturado após acionar %s.",
        source_description,
    )
    return False


async def _download_existing_certificate(page: Page, out_path: Path) -> bool:
    row = page.locator("datatable-body-row").first
    if not await row.count():
        logger.info("[CND Federal] Nenhuma linha de certidão encontrada na tabela.")
        return False

    button = row.locator(".row-actions button.br-button.small.circle").first
    if not await button.count():
        logger.warning("[CND Federal] Botão de download da certidão não localizado.")
        return False

    with contextlib.suppress(Exception):
        await button.scroll_into_view_if_needed(timeout=3000)

    logger.info("[CND Federal] Baixando certidão vigente disponível na tabela.")
    return await _capture_pdf(
        page,
        lambda: button.click(timeout=SELECTOR_TIMEOUT_MS),
        out_path=out_path,
        timeout_ms=DOWNLOAD_TIMEOUT_MS,
        source_description="download existente",
    )


async def _click_nova_consulta(page: Page) -> None:
    botao = page.locator(
        'button.br-button.secondary.btn-acao.btn-acao-3:has-text("Nova Consulta")'
    ).first
    if await botao.count():
        logger.info("[CND Federal] Acionando 'Nova Consulta'.")
        try:
            await botao.click(timeout=SELECTOR_TIMEOUT_MS)
            await page.wait_for_timeout(600)
        except PlaywrightTimeoutError:
            logger.warning("[CND Federal] Timeout ao clicar em 'Nova Consulta'.")


async def _acionar_nova_certidao(page: Page, out_path: Path) -> bool:
    selectors = [
        'div.br-modal button.br-button.primary.btn-acao:has(i.fa.fa-plus):has-text("Nova Certidão")',
        'div.br-modal button.br-button.primary.btn-acao:has-text("Nova Certidão")',
        'button.br-button.primary.btn-acao:has(i.fa.fa-plus):has-text("Nova Certidão")',
        'button.br-button.primary.btn-acao:has-text("Nova Certidão")',
    ]
    loop = asyncio.get_running_loop()
    deadline = loop.time() + DOWNLOAD_TIMEOUT_MS / 1000

    while loop.time() < deadline:
        for selector in selectors:
            locator = page.locator(selector).first
            if not await locator.count():
                continue
            try:
                await locator.wait_for(state="visible", timeout=2000)
            except PlaywrightTimeoutError:
                continue
            with contextlib.suppress(Exception):
                await locator.scroll_into_view_if_needed(timeout=2000)
            logger.info("[CND Federal] Clicando em 'Nova Certidão' (%s).", selector)
            success = await _capture_pdf(
                page,
                lambda: locator.click(timeout=SELECTOR_TIMEOUT_MS),
                out_path=out_path,
                timeout_ms=DOWNLOAD_TIMEOUT_MS,
                source_description="nova certidão",
            )
            if success:
                return True
        await page.wait_for_timeout(500)

    return False


async def _check_known_errors(page: Page) -> Optional[str]:
    try:
        messages = await page.locator("div.msg-resultado > p").all_text_contents()
    except Exception:
        messages = []
    for raw in messages:
        text = (raw or "").strip()
        if text and "insuficientes" in text.lower():
            return text

    try:
        alert = page.locator("#alert-content .description").first
        if await alert.count():
            text = (await alert.inner_text()).strip()
            if text:
                return text
    except Exception:
        pass

    return None


async def _emitir_nova_certidao(page: Page, cnpj_digits: str, out_path: Path) -> tuple[bool, str]:
    await _click_nova_consulta(page)
    await _fill_cnpj_input(page, cnpj_digits)
    await page.wait_for_timeout(400)

    # 1ª tentativa
    if await _acionar_nova_certidao(page, out_path):
        return True, "CND Federal emitida com sucesso."

    mensagem = await _check_known_errors(page)
    if mensagem and (
        "106 -" in mensagem
        or "Não foi possível concluir" in mensagem
        or " 023 " in mensagem
    ):
        logger.warning("[CND Federal] Portal retornou mensagem crítica: %s", mensagem)
        # Soft refresh + retry único
        await page.goto(URL_RFB, wait_until="load", timeout=NAVIGATION_TIMEOUT_MS)
        await _fill_cnpj_input(page, cnpj_digits)
        await page.wait_for_timeout(400)
        if await _acionar_nova_certidao(page, out_path):
            return True, "CND Federal emitida com sucesso (2ª tentativa)."
        mensagem2 = await _check_known_errors(page)
        if mensagem2:
            logger.warning("[CND Federal] Portal retornou mensagem após retry: %s", mensagem2)
        return False, (mensagem2 or mensagem)

    if mensagem:
        logger.warning("[CND Federal] Portal retornou mensagem: %s", mensagem)
        return False, mensagem

    return False, "Não foi possível emitir a CND Federal no portal da RFB."


async def _emitir_cnd_federal_impl(cnpj_digits: str) -> dict:
    logger.info("[CND Federal] Iniciando emissão para o CNPJ %s", cnpj_digits)
    filename = _build_filename()
    out_dir = CND_DIR_BASE / cnpj_digits
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / filename
    url = f"/cnds/{cnpj_digits}/{filename}"

    try:
        async with async_playwright() as pw:
            launch_args = {
                "headless": CND_HEADLESS,
                "args": [
                    "--disable-blink-features=AutomationControlled",
                    "--lang=pt-BR,pt",
                ],
            }
            if CND_CHROME_PATH:
                launch_args["executable_path"] = CND_CHROME_PATH

            user_data_dir = Path(".playwright-user-data") / "rfb"
            user_data_dir.parent.mkdir(parents=True, exist_ok=True)
            browser = await pw.chromium.launch_persistent_context(
                user_data_dir=str(user_data_dir.absolute()),
                **launch_args,
                accept_downloads=True,
                locale="pt-BR",
                timezone_id="America/Sao_Paulo",
                viewport={"width": 1366, "height": 900},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
                ),
            )

            try:
                for existing_page in browser.pages:
                    await existing_page.add_init_script(
                        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
                    )

                page = await browser.new_page()
                await page.add_init_script(
                    "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
                )
                page.set_default_timeout(SELECTOR_TIMEOUT_MS)
                page.set_default_navigation_timeout(NAVIGATION_TIMEOUT_MS)

                await _prepare_initial_consulta(page, cnpj_digits)
                with contextlib.suppress(Exception):
                    await page.wait_for_timeout(1000)

                validade_text, validade_date = await _extract_validade(page)
                limite = datetime.now().date() + timedelta(days=30)
                if validade_date:
                    logger.info(
                        "[CND Federal] Certidão vigente com validade em %s (limite %s).",
                        validade_date,
                        limite,
                    )
                else:
                    logger.info("[CND Federal] Nenhuma certidão vigente encontrada.")

                if validade_date and validade_date > limite:
                    if await _download_existing_certificate(page, out_path):
                        info = "CND Federal vigente baixada com sucesso."
                        return {
                            "ok": True,
                            "info": info,
                            "path": str(out_path),
                            "url": url,
                        }
                    logger.warning(
                        "[CND Federal] Falha ao baixar certidão vigente; tentando nova emissão."
                    )
                else:
                    logger.info(
                        "[CND Federal] Será solicitada uma nova certidão (validade atual: %s)",
                        validade_text or "não informada",
                    )

                sucesso, mensagem = await _emitir_nova_certidao(page, cnpj_digits, out_path)
                if sucesso:
                    return {
                        "ok": True,
                        "info": mensagem,
                        "path": str(out_path),
                        "url": url,
                    }
                return {"ok": False, "info": mensagem, "path": None, "url": None}
            finally:
                with contextlib.suppress(Exception):
                    await browser.close()
    except PlaywrightTimeoutError:
        logger.exception("[CND Federal] Timeout durante a emissão da certidão.")
        return {
            "ok": False,
            "info": "Timeout ao emitir a CND Federal.",
            "path": None,
            "url": None,
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("[CND Federal] Erro inesperado: %s", exc)
        return {
            "ok": False,
            "info": f"Erro ao emitir a CND Federal: {exc}",
            "path": None,
            "url": None,
        }


def _run_in_worker_thread(cnpj_digits: str) -> dict:
    if sys.platform.startswith("win") and hasattr(asyncio, "WindowsProactorEventLoopPolicy"):
        policy = asyncio.WindowsProactorEventLoopPolicy()
    else:
        policy = asyncio.DefaultEventLoopPolicy()

    loop = policy.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(_emitir_cnd_federal_impl(cnpj_digits))
    finally:
        with contextlib.suppress(Exception):
            loop.run_until_complete(loop.shutdown_asyncgens())
        asyncio.set_event_loop(None)
        loop.close()


async def emitir_cnd_federal(cnpj: str) -> dict:
    """Executa a emissão da CND Federal em thread com Proactor quando necessário."""

    cnpj_digits = _only_digits(cnpj)
    if len(cnpj_digits) != 14:
        return {
            "ok": False,
            "info": "CNPJ inválido (14 dígitos).",
            "path": None,
            "url": None,
        }

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        # Sem loop ativo → executa diretamente usando a infraestrutura síncrona
        return _run_in_worker_thread(cnpj_digits)

    return await asyncio.to_thread(_run_in_worker_thread, cnpj_digits)
