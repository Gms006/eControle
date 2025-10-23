import asyncio
import re
import sys
from datetime import datetime
from pathlib import Path

from playwright.async_api import TimeoutError as PlaywrightTimeout
from playwright.async_api import async_playwright

NEROPOLIS_URL = "http://gestaopublica.neropolis.bsit-br.com.br/portal/person/search-certificate-debit.jsf"


async def _emitir_cnd_neropolis_impl(
    cnpj: str,
    *,
    download_dir: Path,
    headless: bool = True,
    chrome_path: str | None = None,
    timeout_ms: int = 60000,
) -> dict:
    cnpj_digits = re.sub(r"\D+", "", cnpj or "")
    if len(cnpj_digits) != 14:
        return {
            "ok": False,
            "info": "CNPJ inválido (precisa ter 14 dígitos)",
            "path": "",
            "url": "",
        }

    out_dir = download_dir / cnpj_digits
    out_dir.mkdir(parents=True, exist_ok=True)
    dt = datetime.now().strftime("%d.%m.%Y")
    filename = f"CND - Neropolis - {dt}.pdf"
    out_path = out_dir / filename
    url_out = f"/cnds/{cnpj_digits}/{filename}"

    launch_args = {"headless": headless}
    if chrome_path:
        launch_args["executable_path"] = chrome_path

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(**launch_args)
            context = None
            try:
                context = await browser.new_context(
                    locale="pt-BR",
                    viewport={"width": 1280, "height": 900},
                    accept_downloads=True,
                )
                page = await context.new_page()

                await page.goto(
                    NEROPOLIS_URL,
                    wait_until="domcontentloaded",
                    timeout=timeout_ms,
                )

                await page.click(
                    'label[for="personCertificateDebitSearchForm:typePerson:1"]',
                    timeout=timeout_ms,
                )

                form_sel = "#personCertificateDebitSearchForm"
                selector_candidates = [
                    "input.cnpj",
                    "input[class*='cnpj']",
                    "input[class*='cpfcnpj']",
                    "input[name*='document']",
                    "input[id*='document']",
                    "input[name*='cpfCnpj']",
                    "input[id*='CpfCnpj']",
                ]

                cnpj_locator = None
                for candidate in selector_candidates:
                    locator = page.locator(f"{form_sel} {candidate}").first
                    try:
                        await locator.wait_for(state="visible", timeout=5000)
                        cnpj_locator = locator
                        break
                    except PlaywrightTimeout:
                        continue

                if cnpj_locator is None:
                    fallback_locator = page.locator(
                        f"{form_sel} input[type='text']:visible"
                    ).first
                    if await fallback_locator.count():
                        cnpj_locator = fallback_locator

                if cnpj_locator is None:
                    return {
                        "ok": False,
                        "info": "Campo de CNPJ não encontrado no portal de Nerópolis.",
                        "path": "",
                        "url": "",
                    }

                await cnpj_locator.fill(cnpj_digits, timeout=timeout_ms)

                try:
                    await cnpj_locator.dispatch_event("change")
                except Exception:
                    pass

                try:
                    await page.click("body")
                except Exception:
                    try:
                        await page.keyboard.press("Tab")
                    except Exception:
                        pass

                imprimir_sel = "#personCertificateDebitSearchForm\\:registerDebitPrint"
                await page.wait_for_selector(
                    imprimir_sel,
                    state="visible",
                    timeout=max(timeout_ms, 120000),
                )
                imprimir_locator = page.locator(imprimir_sel)

                async with page.expect_download(
                    timeout=max(timeout_ms, 120000)
                ) as download_info:
                    await imprimir_locator.click(timeout=timeout_ms)
                download = await download_info.value
                failure = await download.failure()
                if failure:
                    raise RuntimeError(f"Falha no download da CND de Nerópolis: {failure}")
                await download.save_as(str(out_path))

            finally:
                if context is not None:
                    try:
                        await context.close()
                    except Exception:
                        pass
                try:
                    await browser.close()
                except Exception:
                    pass

    except PlaywrightTimeout:
        return {
            "ok": False,
            "info": "Timeout ao gerar a CND de Nerópolis.",
            "path": "",
            "url": "",
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "info": f"Erro ao gerar a CND de Nerópolis: {exc}",
            "path": "",
            "url": "",
        }

    return {
        "ok": True,
        "info": "CND (Nerópolis) gerada com sucesso",
        "path": str(out_path),
        "url": url_out,
    }


async def _to_thread(func, *args, **kwargs):
    if hasattr(asyncio, "to_thread"):
        return await asyncio.to_thread(func, *args, **kwargs)
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: func(*args, **kwargs))


def _run_in_dedicated_event_loop_neropolis(
    *,
    cnpj: str,
    download_dir: Path,
    headless: bool,
    chrome_path: str | None,
    timeout_ms: int,
) -> dict:
    if sys.platform.startswith("win") and hasattr(
        asyncio, "WindowsProactorEventLoopPolicy"
    ):
        policy = asyncio.WindowsProactorEventLoopPolicy()
    else:
        policy = asyncio.DefaultEventLoopPolicy()

    loop = policy.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(
            _emitir_cnd_neropolis_impl(
                cnpj=cnpj,
                download_dir=download_dir,
                headless=headless,
                chrome_path=chrome_path,
                timeout_ms=timeout_ms,
            )
        )
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
        except Exception:
            pass
        asyncio.set_event_loop(None)
        loop.close()


async def emitir_cnd_neropolis(
    cnpj: str,
    *,
    download_dir: Path,
    headless: bool = True,
    chrome_path: str | None = None,
    timeout_ms: int = 60000,
) -> dict:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return await _emitir_cnd_neropolis_impl(
            cnpj=cnpj,
            download_dir=download_dir,
            headless=headless,
            chrome_path=chrome_path,
            timeout_ms=timeout_ms,
        )

    is_windows = sys.platform.startswith("win")
    loop_name = type(loop).__name__.lower()
    selector_like = "selector" in loop_name

    if is_windows and selector_like:
        return await _to_thread(
            _run_in_dedicated_event_loop_neropolis,
            cnpj=cnpj,
            download_dir=download_dir,
            headless=headless,
            chrome_path=chrome_path,
            timeout_ms=timeout_ms,
        )

    return await _emitir_cnd_neropolis_impl(
        cnpj=cnpj,
        download_dir=download_dir,
        headless=headless,
        chrome_path=chrome_path,
        timeout_ms=timeout_ms,
    )
