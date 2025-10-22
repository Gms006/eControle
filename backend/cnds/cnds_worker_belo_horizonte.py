import asyncio
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Callable, Dict

from playwright.async_api import async_playwright

BH_URL = "https://cnd.pbh.gov.br/CNDOnline/"


async def _emitir_cnd_bh_impl(
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

    download_dir = Path(download_dir)
    out_dir = download_dir / cnpj_digits
    out_dir.mkdir(parents=True, exist_ok=True)
    dt = datetime.now().strftime("%d.%m.%Y")
    filename = f"CND - Belo Horizonte - {dt}.pdf"
    out_path = out_dir / filename
    url_out = f"/cnds/{cnpj_digits}/{filename}"

    effective_headless = True
    if not headless:
        # a exportação via page.pdf exige modo headless; força para True
        effective_headless = True

    launch_args: Dict[str, object] = {"headless": effective_headless}
    if chrome_path:
        launch_args["executable_path"] = chrome_path

    try:
        async with async_playwright() as playwright:
            browser = None
            context = None
            try:
                browser = await playwright.chromium.launch(**launch_args)
                context = await browser.new_context(
                    locale="pt-BR",
                    viewport={"width": 1280, "height": 900},
                )

                page = await context.new_page()
                await page.goto(BH_URL, wait_until="domcontentloaded", timeout=timeout_ms)

                await page.click('label[for="meuForm:TIPO1"]', timeout=timeout_ms)
                await page.fill('input#meuForm\\:j_idt129', cnpj_digits, timeout=timeout_ms)

                popup = None
                clicked = False

                try:
                    async with context.expect_page(timeout=timeout_ms) as popup_info:
                        try:
                            await page.click('img[alt="Pesquisar"]', timeout=timeout_ms)
                            clicked = True
                        except Exception:
                            parent = page.locator('img[alt="Pesquisar"]').locator("xpath=..")
                            await parent.click(timeout=timeout_ms)
                            clicked = True
                    popup = await popup_info.value
                except Exception:
                    if not clicked:
                        try:
                            await page.locator('img[alt="Pesquisar"]').locator("xpath=..").click(
                                timeout=timeout_ms
                            )
                            clicked = True
                        except Exception:
                            try:
                                await page.locator('button:has-text("Pesquisar")').click(timeout=timeout_ms)
                                clicked = True
                            except Exception:
                                try:
                                    await page.get_by_role(
                                        "button",
                                        name=re.compile("Pesquisar", re.IGNORECASE),
                                    ).click(timeout=timeout_ms)
                                    clicked = True
                                except Exception:
                                    pass
                    if popup is None:
                        for candidate in context.pages:
                            if candidate is page:
                                continue
                            if "guiaCND.xhtml" in (candidate.url or ""):
                                popup = candidate
                                break

                    if popup is None:
                        popup = await context.wait_for_event(
                            "page",
                            predicate=lambda p: "guiaCND.xhtml" in (p.url or ""),
                            timeout=timeout_ms,
                        )

                if popup is None:
                    raise RuntimeError("Não foi possível capturar a guia da CND.")

                if "guiaCND.xhtml" not in (popup.url or ""):
                    await popup.wait_for_url(
                        lambda url: url is not None and "guiaCND.xhtml" in url,
                        timeout=timeout_ms,
                    )

                await popup.emulate_media(media="print")
                await popup.pdf(path=str(out_path), format="A4", print_background=True)
            finally:
                if context is not None:
                    try:
                        await context.close()
                    except Exception:
                        pass
                if browser is not None:
                    try:
                        await browser.close()
                    except Exception:
                        pass
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "info": f"Falha ao gerar CND de Belo Horizonte: {exc}",
            "path": "",
            "url": "",
        }

    return {
        "ok": True,
        "info": "CND (Belo Horizonte) gerada com sucesso",
        "path": os.fspath(out_path),
        "url": url_out,
    }


async def _to_thread(func: Callable, *args, **kwargs):
    if hasattr(asyncio, "to_thread"):
        return await asyncio.to_thread(func, *args, **kwargs)
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: func(*args, **kwargs))


def _run_in_dedicated_event_loop_bh(
    *,
    cnpj: str,
    download_dir: Path,
    headless: bool,
    chrome_path: str | None,
    timeout_ms: int,
) -> dict:
    if sys.platform.startswith("win") and hasattr(asyncio, "WindowsProactorEventLoopPolicy"):
        policy = asyncio.WindowsProactorEventLoopPolicy()
    else:
        policy = asyncio.DefaultEventLoopPolicy()

    loop = policy.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(
            _emitir_cnd_bh_impl(
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


async def emitir_cnd_belo_horizonte(
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
        return await _emitir_cnd_bh_impl(
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
            _run_in_dedicated_event_loop_bh,
            cnpj=cnpj,
            download_dir=download_dir,
            headless=headless,
            chrome_path=chrome_path,
            timeout_ms=timeout_ms,
        )

    return await _emitir_cnd_bh_impl(
        cnpj=cnpj,
        download_dir=download_dir,
        headless=headless,
        chrome_path=chrome_path,
        timeout_ms=timeout_ms,
    )
