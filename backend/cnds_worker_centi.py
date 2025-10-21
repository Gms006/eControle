import asyncio
import re
import sys
import contextlib
from datetime import datetime
from pathlib import Path
from threading import Thread
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

from playwright.async_api import (
    TimeoutError as PlaywrightTimeoutError,
    async_playwright,
)

def _should_run_in_dedicated_loop() -> bool:
    """Determina se devemos usar um loop Proactor dedicado (Windows/Selector)."""
    if not sys.platform.startswith("win"):
        return False
    try:
        loop = asyncio.get_running_loop()
        return loop.__class__.__name__.lower().startswith("selector")
    except RuntimeError:
        return True

def _run_in_dedicated_event_loop(coro):
    """Executa a coroutine em uma thread com policy Proactor no Windows."""
    result_container = {"exc": None, "result": None}

    def _worker():
        if sys.platform.startswith("win") and hasattr(
            asyncio, "WindowsProactorEventLoopPolicy"
        ):
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        else:
            asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result_container["result"] = loop.run_until_complete(coro)
        except BaseException as exc:  # noqa: BLE001
            result_container["exc"] = exc
        finally:
            try:
                loop.run_until_complete(loop.shutdown_asyncgens())
            except Exception:
                pass
            loop.close()

    thread = Thread(target=_worker, daemon=True)
    thread.start()
    thread.join()
    if result_container["exc"]:
        raise result_container["exc"]
    return result_container["result"]

def _only_digits(value: str) -> str:
    return re.sub(r"\D+", "", value or "")


def _mask_cnpj(value: str) -> str:
    digits = _only_digits(value)
    if len(digits) != 14:
        return value
    return (
        f"{digits[0:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:14]}"
    )

def _slug_from_base_url(base_url: str, fallback: str) -> str:
    hostname = ""
    try:
        parsed = urlparse(base_url)
        hostname = parsed.hostname or ""
    except Exception:
        hostname = ""

    if hostname:
        candidate = hostname.split(".")[0].strip().lower()
        candidate = re.sub(r"[^a-z0-9]+", "", candidate)
        if candidate:
            return candidate

    normalized = re.sub(r"[^a-z0-9]+", " ", fallback.lower()).strip()
    normalized = re.sub(r"\s+", " ", normalized)
    slug = normalized.replace(" ", "")
    return slug or "municipio"

def _build_filename(slug: str) -> str:
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    return f"{timestamp}_CND_Municipal_{slug}.pdf"

def _static_url(cnpj: str, filename: str) -> str:
    return f"/cnds/{cnpj}/{filename}"

async def _collect_messages(page) -> List[str]:
    selectors = [
        "#cpfcnpjcontribuinte ~ .invalid-feedback",
        "#cpfcnpjcontribuinte ~ span.text-danger",
        "#cpfcnpjcontribuinte ~ small.text-danger",
        ".alert",
        ".alert-danger",
        ".alert-warning",
        ".toast-message",
        ".swal2-content",
        ".swal2-html-container",
    ]
    messages: List[str] = []
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
    return messages

async def _fetch_blob(page, blob_url: str) -> Optional[bytes]:
    try:
        data = await page.evaluate(
            """
            async blobUrl => {
                const response = await fetch(blobUrl);
                const buffer = await response.arrayBuffer();
                return Array.from(new Uint8Array(buffer));
            }
            """,
            blob_url,
        )
        if isinstance(data, list) and data:
            return bytes(data)
    except Exception:
        return None
    return None

def _ensure_absolute(url: str, base: str) -> str:
    if not url:
        return url
    if url.startswith(("http://", "https://", "blob:", "data:")):
        return url
    return urljoin(base, url)

async def _extract_pdf_from_popup(page, *, timeout_ms: int) -> Optional[bytes]:
    try:
        await page.wait_for_load_state("domcontentloaded", timeout=timeout_ms)
    except PlaywrightTimeoutError:
        pass

    try:
        await page.wait_for_load_state("networkidle", timeout=timeout_ms)
    except PlaywrightTimeoutError:
        pass

    selectors = [
        "embed[src]",
        "iframe[src]",
        "object[data]",
        "a[href$='.pdf']",
        "a[href*='.pdf?']",
    ]

    for selector in selectors:
        try:
            locator = page.locator(selector).first
            await locator.wait_for(state="attached", timeout=2000)
            attribute = (
                await locator.get_attribute("src")
                or await locator.get_attribute("data")
                or await locator.get_attribute("href")
            )
            if not attribute:
                continue
            url = _ensure_absolute(attribute, page.url)
            if url.startswith("blob:"):
                blob_bytes = await _fetch_blob(page, url)
                if blob_bytes:
                    return blob_bytes
                continue
            response = await page.request.get(url)
            if response.ok:
                content_type = (response.headers.get("content-type") or "").lower()
                if "application/pdf" in content_type:
                    return await response.body()
        except PlaywrightTimeoutError:
            continue
        except Exception:
            continue

    try:
        await page.wait_for_timeout(500)
    except Exception:
        pass
    return None

async def _emitir_cnd_centi_impl(
    cnpj: str,
    base_url: str,
    municipio: str,
    download_dir: str,
    *,
    headless: bool = True,
    chrome_path: Optional[str] = None,
    timeout_ms: int = 30000,
) -> Dict[str, object]:
    cnpj_digits = _only_digits(cnpj)
    if len(cnpj_digits) != 14:
        return {
            "ok": False,
            "portal": "Centi",
            "municipio": municipio,
            "cnpj": cnpj_digits,
            "file_path": None,
            "public_url": None,
            "message": "CNPJ inválido (14 dígitos).",
            "details": {"slug": None, "base_url": base_url},
        }

    if not base_url:
        return {
            "ok": False,
            "portal": "Centi",
            "municipio": municipio,
            "cnpj": cnpj_digits,
            "file_path": None,
            "public_url": None,
            "message": "URL do portal Centi não configurada.",
            "details": {"slug": None, "base_url": base_url},
        }

    download_path = Path(download_dir)
    slug = _slug_from_base_url(base_url, municipio)
    filename = _build_filename(slug)
    destino_dir = download_path / cnpj_digits
    destino_dir.mkdir(parents=True, exist_ok=True)
    destino = destino_dir / filename
    public_url = _static_url(cnpj_digits, filename)

    print(f"[CENTI] 🚀 Iniciando emissão para {municipio} ({slug})")
    print(f"[CENTI] 🔗 URL base: {base_url}")
    print(f"[CENTI] 📋 CNPJ: {cnpj_digits}")

    timeout_seconds = max(timeout_ms, 1000) / 1000
    loop = asyncio.get_running_loop()

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
            context = await browser.new_context(
                accept_downloads=True,
                ignore_https_errors=True,
            )
            page = await context.new_page()

            pdf_future: asyncio.Future = loop.create_future()
            dialog_messages: List[str] = []

            def handle_response(response):
                try:
                    content_type = (
                        response.headers.get("content-type") or ""
                    ).lower()
                except Exception:
                    content_type = ""
                if "application/pdf" in content_type and not pdf_future.done():
                    pdf_future.set_result(response)

            context.on("response", handle_response)

            async def handle_dialog(dialog):
                message = (dialog.message or "").strip()
                if message:
                    dialog_messages.append(message)
                try:
                    await dialog.dismiss()
                except Exception:
                    pass

            page.on("dialog", lambda dialog: asyncio.create_task(handle_dialog(dialog)))

            download_task: Optional[asyncio.Task] = None
            popup_task: Optional[asyncio.Task] = None

            try:
                try:
                    await page.goto(base_url, wait_until="domcontentloaded", timeout=timeout_ms)
                except PlaywrightTimeoutError:
                    return {
                        "ok": False,
                        "portal": "Centi",
                        "municipio": municipio,
                        "cnpj": cnpj_digits,
                        "file_path": None,
                        "public_url": None,
                        "message": "Timeout ao acessar o portal Centi.",
                        "details": {
                            "slug": slug,
                            "base_url": base_url,
                            "dialog_messages": dialog_messages,
                        },
                    }

                try:
                    input_cnpj = page.locator(
                        "input#cpfcnpjcontribuinte[data-type='cpfcnpj'][name='cpfcnpjcontribuinte']"
                    )
                    await input_cnpj.wait_for(state="visible", timeout=timeout_ms)
                except PlaywrightTimeoutError:
                    return {
                        "ok": False,
                        "portal": "Centi",
                        "municipio": municipio,
                        "cnpj": cnpj_digits,
                        "file_path": None,
                        "public_url": None,
                        "message": "Campo de CNPJ não encontrado no portal Centi.",
                        "details": {
                            "slug": slug,
                            "base_url": base_url,
                            "dialog_messages": dialog_messages,
                        },
                    }

                print("[CENTI] ⌨️ Preenchendo CNPJ (somente dígitos; máscara automática do portal)…")
                # Foco e limpeza
                await input_cnpj.click()
                await input_cnpj.press("Control+A")
                await input_cnpj.press("Delete")

                # Digita APENAS dígitos; o portal aplica a máscara sozinho
                await input_cnpj.type(cnpj_digits, delay=50)

                # Dispara validações reativas e segue em frente (não precisamos aguardar botão)
                try:
                    await page.dispatch_event("#cpfcnpjcontribuinte", "input")
                    await page.dispatch_event("#cpfcnpjcontribuinte", "change")
                except Exception:
                    pass
                await input_cnpj.blur()

                button = page.locator(
                    "input[type='submit'][value='Emitir'].btn.btn-primary"
                )
                try:
                    await button.wait_for(state="visible", timeout=timeout_ms)
                except PlaywrightTimeoutError:
                    return {
                        "ok": False,
                        "portal": "Centi",
                        "municipio": municipio,
                        "cnpj": cnpj_digits,
                        "file_path": None,
                        "public_url": None,
                        "message": "Botão 'Emitir' não localizado no portal Centi.",
                        "details": {
                            "slug": slug,
                            "base_url": base_url,
                            "dialog_messages": dialog_messages,
                        },
                    }

                print("[CENTI] 🖱️ Acionando emissão...")
                
                # Criar os listeners IMEDIATAMENTE ANTES do clique
                download_task = asyncio.create_task(
                    page.wait_for_event("download", timeout=timeout_ms)
                )
                popup_task_ctx = asyncio.create_task(
                    context.wait_for_event("page", timeout=timeout_ms)
                )
                popup_task_page = asyncio.create_task(
                    page.wait_for_event("popup", timeout=timeout_ms)
                )
                
                await button.click()

                pdf_bytes: Optional[bytes] = None
                download_obj = None
                popup_handled = False
                popup_error: Optional[str] = None
                start_time = loop.time()

                try:
                    while True:
                        elapsed = loop.time() - start_time
                        remaining = timeout_seconds - elapsed
                        if remaining <= 0:
                            print("[CENTI] ⏰ Timeout atingido no loop de captura")
                            break

                        wait_set = []
                        if not pdf_future.done():
                            wait_set.append(pdf_future)
                        if download_task and not download_task.done():
                            wait_set.append(download_task)
                        if popup_task_ctx and not popup_task_ctx.done():
                            wait_set.append(popup_task_ctx)
                        if popup_task_page and not popup_task_page.done():
                            wait_set.append(popup_task_page)

                        if not wait_set:
                            print("[CENTI] 🔍 Nenhuma task pendente, encerrando loop")
                            break

                        done, _ = await asyncio.wait(
                            wait_set,
                            timeout=remaining,
                            return_when=asyncio.FIRST_COMPLETED,
                        )

                        if not done:
                            print("[CENTI] ⏰ Timeout no asyncio.wait")
                            break

                        if pdf_future in done:
                            try:
                                response = pdf_future.result()
                                pdf_bytes = await response.body()
                                print(f"[CENTI] 📥 PDF capturado via response: {response.url}")
                                # Cancela quaisquer outras esperas pendentes para evitar CancelledError na faxina
                                for t in (download_task, popup_task_ctx, popup_task_page):
                                    if t and not t.done():
                                        t.cancel()
                                break
                            except Exception as exc:
                                print(f"[CENTI] ⚠️ Falha ao obter PDF da response: {exc}")
                                continue

                        if download_task in done:
                            try:
                                download_obj = download_task.result()
                                print("[CENTI] 📥 Download direto detectado")
                                break
                            except Exception as exc:
                                print(f"[CENTI] ⚠️ Falha no download: {exc}")
                                download_task = None
                                continue

                        if popup_task_ctx in done:
                            popup_page_ctx = popup_task_ctx.result()
                            popup_handled = True
                            print(f"[CENTI] 🪟 Nova aba detectada (context.page): {popup_page_ctx.url}")
                            try:
                                # Usar timeout maior e fixo para extração do PDF
                                popup_bytes = await _extract_pdf_from_popup(
                                    popup_page_ctx, timeout_ms=10000
                                )
                                if popup_bytes:
                                    pdf_bytes = popup_bytes
                                    print("[CENTI] 📥 PDF extraído da nova aba (context.page)")
                                    break
                                else:
                                    print("[CENTI] ⚠️ Nenhum PDF encontrado na nova aba (context.page)")
                            except Exception as exc:
                                popup_error = str(exc)
                                print(f"[CENTI] ⚠️ Falha ao extrair PDF (context.page): {exc}")
                            finally:
                                popup_task_ctx = asyncio.create_task(
                                    context.wait_for_event("page", timeout=timeout_ms)
                                )

                        if popup_task_page in done:
                            popup_page_pop = popup_task_page.result()
                            popup_handled = True
                            print(f"[CENTI] 🪟 Nova aba detectada (page.popup): {popup_page_pop.url}")
                            try:
                                # Usar timeout maior e fixo para extração do PDF
                                popup_bytes = await _extract_pdf_from_popup(
                                    popup_page_pop, timeout_ms=10000
                                )
                                if popup_bytes:
                                    pdf_bytes = popup_bytes
                                    print("[CENTI] 📥 PDF extraído da popup (page.popup)")
                                    break
                                else:
                                    print("[CENTI] ⚠️ Nenhum PDF encontrado na popup (page.popup)")
                            except Exception as exc:
                                popup_error = str(exc)
                                print(f"[CENTI] ⚠️ Falha ao extrair PDF (page.popup): {exc}")
                            finally:
                                popup_task_page = asyncio.create_task(
                                    page.wait_for_event("popup", timeout=timeout_ms)
                                )

                            continue
                finally:
                    for task in (download_task, popup_task_ctx, popup_task_page):
                        if task and not task.done():
                            task.cancel()
                            # CancelledError pode borbulhar — suprimir aqui evita derrubar a requisição ASGI
                            with contextlib.suppress(asyncio.CancelledError, Exception):
                                await task
                    if not pdf_future.done():
                        pdf_future.cancel()

                if download_obj:
                    try:
                        await download_obj.save_as(destino)
                        print(f"[CENTI] ✅ Certidão salva via download: {destino}")
                        return {
                            "ok": True,
                            "portal": "Centi",
                            "municipio": municipio,
                            "cnpj": cnpj_digits,
                            "file_path": str(destino),
                            "public_url": public_url,
                            "message": "Certidão emitida com sucesso.",
                            "details": {
                                "slug": slug,
                                "base_url": base_url,
                                "dialog_messages": dialog_messages,
                            },
                        }
                    except Exception as exc:
                        print(f"[CENTI] ❌ Falha ao salvar download: {exc}")

                if pdf_bytes:
                    try:
                        destino.write_bytes(pdf_bytes)
                        print(f"[CENTI] ✅ Certidão salva via bytes: {destino}")
                        return {
                            "ok": True,
                            "portal": "Centi",
                            "municipio": municipio,
                            "cnpj": cnpj_digits,
                            "file_path": str(destino),
                            "public_url": public_url,
                            "message": "Certidão emitida com sucesso.",
                            "details": {
                                "slug": slug,
                                "base_url": base_url,
                                "dialog_messages": dialog_messages,
                            },
                        }
                    except Exception as exc:
                        print(f"[CENTI] ❌ Falha ao salvar bytes do PDF: {exc}")

                inline_messages = await _collect_messages(page)
                detail_messages: Dict[str, object] = {
                    "slug": slug,
                    "base_url": base_url,
                    "dialog_messages": dialog_messages,
                }
                if inline_messages:
                    detail_messages["page_messages"] = inline_messages
                if popup_handled and popup_error:
                    detail_messages["popup_error"] = popup_error

                fallback_message = (
                    inline_messages[0]
                    if inline_messages
                    else (
                        dialog_messages[-1]
                        if dialog_messages
                        else "Não foi possível localizar a certidão para o CNPJ informado."
                    )
                )

                return {
                    "ok": False,
                    "portal": "Centi",
                    "municipio": municipio,
                    "cnpj": cnpj_digits,
                    "file_path": None,
                    "public_url": None,
                    "message": fallback_message,
                    "details": detail_messages,
                }
            finally:
                try:
                    context.off("response", handle_response)
                except Exception:
                    pass
                await context.close()
                await browser.close()
    except PlaywrightTimeoutError:
        return {
            "ok": False,
            "portal": "Centi",
            "municipio": municipio,
            "cnpj": cnpj_digits,
            "file_path": None,
            "public_url": None,
            "message": "Timeout ao processar solicitação no portal Centi.",
            "details": {"slug": slug, "base_url": base_url},
        }
    except Exception as exc:
        return {
            "ok": False,
            "portal": "Centi",
            "municipio": municipio,
            "cnpj": cnpj_digits,
            "file_path": None,
            "public_url": None,
            "message": f"Erro inesperado no portal Centi: {exc}",
            "details": {"slug": slug, "base_url": base_url},
        }

def emitir_cnd_centi(
    cnpj: str,
    base_url: str,
    municipio: str,
    download_dir: str,
    *,
    headless: bool = True,
    chrome_path: Optional[str] = None,
    timeout_ms: int = 30000,
) -> Dict[str, object]:
    coro = _emitir_cnd_centi_impl(
        cnpj=cnpj,
        base_url=base_url,
        municipio=municipio,
        download_dir=download_dir,
        headless=headless,
        chrome_path=chrome_path,
        timeout_ms=timeout_ms,
    )

    if _should_run_in_dedicated_loop():
        return _run_in_dedicated_event_loop(coro)

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)

    return loop.run_until_complete(coro)
