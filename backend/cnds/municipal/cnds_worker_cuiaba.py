import re
import sys
import asyncio
from pathlib import Path
from datetime import datetime
from playwright.async_api import async_playwright

CUIABA_URL = "https://portalfazenda.cuiaba.mt.gov.br/portalfazenda/PortalContribuinte/EmitirCertidao"


async def _emitir_cnd_cuiaba_impl(
    cnpj: str,
    *,
    download_dir: Path,
    headless: bool = True,
    chrome_path: str | None = None,
    timeout_ms: int = 60000,
) -> dict:
    # 1) normaliza CNPJ
    cnpj_digits = re.sub(r"\D+", "", cnpj or "")
    if len(cnpj_digits) != 14:
        return {"ok": False, "info": "CNPJ inválido (precisa ter 14 dígitos)", "path": "", "url": ""}

    out_dir = download_dir / cnpj_digits
    out_dir.mkdir(parents=True, exist_ok=True)
    dt = datetime.now().strftime("%d.%m.%Y")
    filename = f"CND - Cuiaba - {dt}.pdf"
    out_path = out_dir / filename
    url_out = f"/cnds/{cnpj_digits}/{filename}"

    launch_args = {"headless": True}  # força headless, mais estável
    if chrome_path:
        launch_args["executable_path"] = chrome_path

    async with async_playwright() as p:
        browser = await p.chromium.launch(**launch_args)
        # Aceitar downloads no contexto
        context = await browser.new_context(
            locale="pt-BR",
            viewport={"width": 1280, "height": 900},
            accept_downloads=True,
        )
        page = await context.new_page()

        # 2) abre portal
        await page.goto(CUIABA_URL, wait_until="domcontentloaded", timeout=timeout_ms)

        # 3) preenche CNPJ (o campo aceita formato CPF/CNPJ com máscara; force apenas dígitos)
        await page.fill("#ContentPageBody_txtCpfCnpj", cnpj_digits, timeout=timeout_ms)

        # 4) clicar "Emitir" e capturar o download
        async with page.expect_download(timeout=timeout_ms) as dl_info:
            await page.click("#ContentPageBody_lkbEmitirCertidao", timeout=timeout_ms)
        download = await dl_info.value

        # 5) salva o PDF
        # nome sugerido pelo servidor pode variar; usamos nosso padrão ao salvar
        await download.save_as(str(out_path))

        await context.close()
        await browser.close()

    return {"ok": True, "info": "CND (Cuiabá) gerada com sucesso", "path": str(out_path), "url": url_out}


# ---------- infra de execução (Windows: Proactor em thread) ----------


async def _to_thread(func, *args, **kwargs):
    if hasattr(asyncio, "to_thread"):
        return await asyncio.to_thread(func, *args, **kwargs)
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: func(*args, **kwargs))


def _run_in_dedicated_event_loop_cuiaba(
    *,
    cnpj: str,
    download_dir: Path,
    headless: bool,
    chrome_path: str | None,
    timeout_ms: int,
) -> dict:
    # no Windows: usar Proactor; demais SOs: Default
    if sys.platform.startswith("win") and hasattr(asyncio, "WindowsProactorEventLoopPolicy"):
        policy = asyncio.WindowsProactorEventLoopPolicy()
    else:
        policy = asyncio.DefaultEventLoopPolicy()

    loop = policy.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(
            _emitir_cnd_cuiaba_impl(
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


async def emitir_cnd_cuiaba(
    cnpj: str,
    *,
    download_dir: Path,
    headless: bool = True,
    chrome_path: str | None = None,
    timeout_ms: int = 60000,
) -> dict:
    """
    Entrypoint público: roda direto se possível; em Windows+SelectorEventLoop,
    despacha para thread com loop Proactor dedicado (previne NotImplementedError).
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # sem loop → contexto sync: roda direto
        return await _emitir_cnd_cuiaba_impl(
            cnpj=cnpj,
            download_dir=download_dir,
            headless=headless,
            chrome_path=chrome_path,
            timeout_ms=timeout_ms,
        )

    is_windows = sys.platform.startswith("win")
    loop_name = type(loop).__name__.lower()
    selector_like = "selector" in loop_name  # padrão uvicorn/fastapi no Windows

    if is_windows and selector_like:
        return await _to_thread(
            _run_in_dedicated_event_loop_cuiaba,
            cnpj=cnpj,
            download_dir=download_dir,
            headless=headless,
            chrome_path=chrome_path,
            timeout_ms=timeout_ms,
        )

    # Linux/Mac ou já Proactor: roda direto
    return await _emitir_cnd_cuiaba_impl(
        cnpj=cnpj,
        download_dir=download_dir,
        headless=headless,
        chrome_path=chrome_path,
        timeout_ms=timeout_ms,
    )
