import asyncio
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from playwright.async_api import (
    TimeoutError as PlaywrightTimeoutError,
    async_playwright,
)

_STOPWORDS = {"do", "da", "de", "dos", "das"}


def _only_digits(value: str) -> str:
    return re.sub(r"\D+", "", value or "")


def _slugify_city(value: str) -> str:
    import unicodedata

    if not value:
        return "municipio"

    normalized = (
        unicodedata.normalize("NFD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )
    parts = [part for part in re.split(r"[^a-z0-9]+", normalized) if part]
    filtered = [part for part in parts if part not in _STOPWORDS]
    slug = "".join(filtered) or "".join(parts)
    slug = slug or "municipio"
    return slug


def _build_filename(slug: str) -> str:
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    return f"{timestamp}_CND_Municipal_{slug}.pdf"


def _static_url(cnpj: str, filename: str) -> str:
    return f"/cnds/{cnpj}/{filename}"


async def _wait_for_message(page, timeout_ms: int) -> Optional[str]:
    selectors = [
        ".toast-message",
        ".toast-body",
        ".alert",
        ".alert-danger",
        ".alert-warning",
        ".swal2-content",
        ".swal2-html-container",
        ".message",
    ]
    poll_interval = 0.4
    loop = asyncio.get_running_loop()
    deadline = loop.time() + max(timeout_ms, 0) / 1000

    while loop.time() <= deadline:
        for selector in selectors:
            try:
                locator = page.locator(selector)
                count = await locator.count()
                for idx in range(count):
                    text = (await locator.nth(idx).inner_text() or "").strip()
                    if text:
                        return text
            except Exception:
                continue
        await asyncio.sleep(poll_interval)

    return None


async def _collect_messages(page) -> Optional[str]:
    selectors = [
        ".toast-message",
        ".toast-body",
        ".alert",
        ".alert-danger",
        ".alert-warning",
        ".swal2-content",
        ".swal2-html-container",
        ".message",
    ]
    messages = []
    for selector in selectors:
        try:
            locator = page.locator(selector)
            count = await locator.count()
            for idx in range(count):
                text = (await locator.nth(idx).inner_text() or "").strip()
                if text and text not in messages:
                    messages.append(text)
        except Exception:
            continue
    if messages:
        return " | ".join(messages)
    return None


async def emitir_cnd_sig(
    cnpj: str,
    base_url: str,
    cidade: str,
    *,
    download_dir: Path,
    headless: bool = True,
    chrome_path: Optional[str] = None,
    timeout_ms: int = 30000,
) -> Dict:
    if _should_run_in_dedicated_loop():
        kwargs = {
            "cnpj": cnpj,
            "base_url": base_url,
            "cidade": cidade,
            "download_dir": download_dir,
            "headless": headless,
            "chrome_path": chrome_path,
            "timeout_ms": timeout_ms,
        }
        return await _run_in_dedicated_loop(**kwargs)

    return await _emitir_cnd_sig_impl(
        cnpj=cnpj,
        base_url=base_url,
        cidade=cidade,
        download_dir=download_dir,
        headless=headless,
        chrome_path=chrome_path,
        timeout_ms=timeout_ms,
    )


def _should_run_in_dedicated_loop() -> bool:
    # No Windows, o Playwright lança o Chromium via subprocess.
    # Para evitar NotImplementedError em loops Selector, SEMPRE use um loop Proactor dedicado.
    return sys.platform.startswith("win")


async def _run_in_dedicated_loop(**kwargs) -> Dict:
    def runner() -> Dict:
        try:
            from asyncio import windows_events  # type: ignore

            loop = windows_events.ProactorEventLoop()
            try:
                asyncio.set_event_loop(loop)
                return loop.run_until_complete(_emitir_cnd_sig_impl(**kwargs))
            finally:
                loop.close()
        except ImportError:
            return asyncio.run(_emitir_cnd_sig_impl(**kwargs))

    if hasattr(asyncio, "to_thread"):
        return await asyncio.to_thread(runner)

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, runner)


async def _emitir_cnd_sig_impl(
    *,
    cnpj: str,
    base_url: str,
    cidade: str,
    download_dir: Path,
    headless: bool,
    chrome_path: Optional[str],
    timeout_ms: int,
) -> Dict:
    cnpj_digits = _only_digits(cnpj)
    if len(cnpj_digits) != 14:
        return {
            "ok": False,
            "info": "CNPJ inválido (14 dígitos).",
            "path": None,
            "url": None,
        }

    if not base_url:
        return {
            "ok": False,
            "info": "URL do município SIG não configurada.",
            "path": None,
            "url": None,
        }

    slug = _slugify_city(cidade)
    filename = _build_filename(slug)
    destino_dir = download_dir / cnpj_digits
    destino_dir.mkdir(parents=True, exist_ok=True)
    destino = destino_dir / filename

    print(f"[SIG] 🚀 Iniciando emissão para {cidade} ({slug})")
    print(f"[SIG] 🔗 URL base: {base_url}")
    print(f"[SIG] 📋 CNPJ: {cnpj_digits}")

    try:
        async with async_playwright() as p:
            launch_args: Dict[str, object] = {
                "headless": headless,
                "args": [
                    "--disable-gpu",
                    "--disable-dev-shm-usage",
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--no-sandbox",
                ],
            }
            if chrome_path:
                launch_args["executable_path"] = chrome_path

            browser = await p.chromium.launch(**launch_args)
            context = None
            try:
                context = await browser.new_context(
                    accept_downloads=False, ignore_https_errors=True
                )
                page = await context.new_page()

                try:
                    print("[SIG] 🌐 Carregando portal SIG...")
                    await page.goto(base_url, wait_until="domcontentloaded", timeout=timeout_ms)
                    try:
                        await page.wait_for_load_state("networkidle", timeout=timeout_ms)
                    except PlaywrightTimeoutError:
                        pass

                    input_cnpj = page.locator('input[id$="inputText"][type="text"]').first
                    if await input_cnpj.count() == 0:
                        input_cnpj = page.locator(
                            'xpath=//label[contains(normalize-space(.),"CPF/CNPJ")]/following::input[1]'
                        )

                    botao_pesquisar = page.locator('button[ng-click="vm.pesquisar()"]').first
                    botao_imprimir = page.locator('button[ng-click^="vm.imprimir"]').first

                    await page.wait_for_selector(
                        'md-content, .pd-app, .ui-view, [ui-view]', timeout=timeout_ms
                    )
                    try:
                        await input_cnpj.wait_for(state="visible", timeout=timeout_ms)
                        await input_cnpj.scroll_into_view_if_needed()
                        await botao_pesquisar.wait_for(state="visible", timeout=timeout_ms)
                    except PlaywrightTimeoutError:
                        mensagens = await _collect_messages(page)
                        info = "Elementos SIG não encontrados (input/pesquisar/imprimir)."
                        if mensagens:
                            info = f"{info} Detalhes: {mensagens}"
                        print(f"[SIG] ❌ {info}")
                        return {"ok": False, "info": info, "path": None, "url": None}

                    print("[SIG] ⌨️ Preenchendo CNPJ...")
                    await input_cnpj.fill(cnpj_digits)

                    print("[SIG] 🔍 Clicando em 'Pesquisar'...")
                    await botao_pesquisar.click()

                    def _fmt_cnpj(n: str) -> str:
                        n = "".join(ch for ch in n if ch.isdigit()).zfill(14)
                        return f"{n[0:2]}.{n[2:5]}.{n[5:8]}/{n[8:12]}-{n[12:14]}"

                    cnpj_masked = _fmt_cnpj(cnpj)

                    banner_nenhum = page.locator(
                        '.pd-grid-nenhum-registro span:has-text("Nenhum registro")'
                    )
                    grid_hit = page.locator(
                        f'.ui-grid-canvas >> text="{cnpj_masked}"'
                    )

                    try:
                        await banner_nenhum.wait_for(state="visible", timeout=3000)
                        info = "Nenhum registro — o SIG não retornou certidão para o CNPJ informado."
                        print(f"[SIG] ⚠️ {info}")
                        return {"ok": False, "info": info, "path": None, "url": None}
                    except PlaywrightTimeoutError:
                        pass

                    try:
                        await grid_hit.wait_for(state="visible", timeout=timeout_ms)
                        print(f"[SIG] ✅ CNPJ localizado na grade: {cnpj_masked}")
                    except PlaywrightTimeoutError:
                        linhas = await page.locator('.ui-grid-row').count()
                        if linhas == 0 and await banner_nenhum.count() > 0:
                            info = "Nenhum registro — o SIG não retornou certidão para o CNPJ informado."
                            print(f"[SIG] ⚠️ {info}")
                            return {"ok": False, "info": info, "path": None, "url": None}
                        info = "Elementos SIG não retornaram resultado (nem grade com CNPJ, nem banner)."
                        print(f"[SIG] ❌ {info}")
                        return {"ok": False, "info": info, "path": None, "url": None}

                    try:
                        await botao_imprimir.wait_for(state="visible", timeout=timeout_ms)
                    except PlaywrightTimeoutError:
                        mensagens = await _collect_messages(page)
                        info = "Elementos SIG não encontrados (input/pesquisar/imprimir)."
                        if mensagens:
                            info = f"{info} Detalhes: {mensagens}"
                        print(f"[SIG] ❌ {info}")
                        return {"ok": False, "info": info, "path": None, "url": None}

                    try:
                        is_disabled = await botao_imprimir.get_attribute("disabled")
                        if is_disabled:
                            mensagem = await _collect_messages(page)
                            info = "Portal SIG não habilitou o botão de impressão."
                            if mensagem:
                                info = f"{info} Detalhes: {mensagem}"
                            print(f"[SIG] ❌ {info}")
                            return {"ok": False, "info": info, "path": None, "url": None}
                    except Exception:
                        pass

                    print("[SIG] 🖨️ Clicando em 'Imprimir certidão'...")
                    popup_timeout = min(timeout_ms, 10000)
                    popup_task = asyncio.create_task(
                        page.wait_for_event("popup", timeout=popup_timeout)
                    )

                    await botao_imprimir.scroll_into_view_if_needed()
                    try:
                        await botao_imprimir.click()
                    except Exception:
                        await botao_imprimir.click(force=True)

                    try:
                        jasper_page = await popup_task
                    except PlaywrightTimeoutError:
                        jasper_page = None
                    except Exception:
                        jasper_page = None

                    if jasper_page is None:
                        try:
                            await page.wait_for_url("**/jasperservlet**", timeout=timeout_ms)
                            jasper_page = page
                        except PlaywrightTimeoutError:
                            mensagem = await _collect_messages(page)
                            info = "Falha ao abrir certidão no SIG (timeout)."
                            if mensagem:
                                info = f"{info} Detalhes: {mensagem}"
                            print(f"[SIG] ❌ {info}")
                            return {"ok": False, "info": info, "path": None, "url": None}
                        except Exception as exc:
                            mensagem = await _collect_messages(page)
                            info = f"Falha ao abrir certidão no SIG: {exc}"
                            if mensagem:
                                info = f"{info} Detalhes: {mensagem}"
                            print(f"[SIG] ❌ {info}")
                            return {"ok": False, "info": info, "path": None, "url": None}
                    try:
                        await jasper_page.wait_for_load_state("load", timeout=timeout_ms)
                    except PlaywrightTimeoutError:
                        pass

                    jasper_url = jasper_page.url
                    if "jasperservlet" not in jasper_url:
                        try:
                            await jasper_page.wait_for_url("**/jasperservlet**", timeout=timeout_ms)
                            jasper_url = jasper_page.url
                        except PlaywrightTimeoutError:
                            mensagem = await _collect_messages(page)
                            info = "Falha ao localizar URL da certidão no SIG."
                            if mensagem:
                                info = f"{info} Detalhes: {mensagem}"
                            print(f"[SIG] ❌ {info}")
                            return {"ok": False, "info": info, "path": None, "url": None}

                    print(f"[SIG] 📄 URL Jasper: {jasper_url}")

                    response = await context.request.get(jasper_url)
                    status = response.status
                    if status != 200:
                        info = f"Falha ao baixar certidão (HTTP {status})."
                        print(f"[SIG] ❌ {info}")
                        return {"ok": False, "info": info, "path": None, "url": None}

                    conteudo = await response.body()
                    destino.write_bytes(conteudo)
                    caminho_absoluto = str(destino.resolve())
                    url_publica = _static_url(cnpj_digits, filename)

                    print(f"[SIG] ✅ Certidão salva em {caminho_absoluto}")
                    return {
                        "ok": True,
                        "info": "Certidão emitida com sucesso.",
                        "path": caminho_absoluto,
                        "url": url_publica,
                    }

                finally:
                    if context is not None:
                        await context.close()
            finally:
                await browser.close()

    except PlaywrightTimeoutError as exc:
        info = f"Timeout ao acessar o portal SIG: {exc}"
        print(f"[SIG] ⏰ {info}")
        return {"ok": False, "info": info, "path": None, "url": None}
    except NotImplementedError:
        # Fallback extra: se por algum motivo chegamos aqui, força execução no loop dedicado.
        if not _should_run_in_dedicated_loop() and sys.platform.startswith("win"):
            return await _run_in_dedicated_loop(
                cnpj=cnpj,
                base_url=base_url,
                cidade=cidade,
                download_dir=download_dir,
                headless=headless,
                chrome_path=chrome_path,
                timeout_ms=timeout_ms,
            )
        raise
    except Exception as exc:
        info = f"Erro inesperado no fluxo SIG: {exc}"
        print(f"[SIG] ❌ {info}")
        return {"ok": False, "info": info, "path": None, "url": None}

