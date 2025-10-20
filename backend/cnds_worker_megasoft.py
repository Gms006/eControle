import asyncio
import os
import re
import sys

from datetime import datetime
from pathlib import Path
from typing import Dict, Optional
from urllib.parse import urlparse

from playwright.async_api import (
    TimeoutError as PlaywrightTimeoutError,
    async_playwright,
)


def _only_digits(value: str) -> str:
    return re.sub(r"\D+", "", value or "")


def _normalize_city(value: str) -> str:
    import unicodedata

    if not value:
        return ""

    normalized = (
        unicodedata.normalize("NFD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return " ".join(normalized.split())


def _ensure_https(url: str) -> str:
    if not url:
        return url
    url = url.strip()
    if url.startswith("http://"):
        url = "https://" + url[len("http://") :]
    if not url.startswith("https://"):
        url = f"https://{url.lstrip('/')}"
    return url


def _resolve_slug(base_url: str, cidade: str) -> str:
    hostname = ""
    try:
        parsed = urlparse(base_url)
        hostname = parsed.hostname or ""
    except Exception:
        hostname = ""

    if hostname:
        candidate = hostname.split(".")[0]
        candidate = re.sub(r"[^a-z0-9]+", "", candidate.lower())
        if candidate:
            return candidate

    normalized = _normalize_city(cidade)
    fallback = normalized.replace(" ", "")
    return fallback or "municipio"


def _build_filename(slug: str) -> str:
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    return f"{timestamp}_CND_Municipal_{slug}.pdf"


def _static_url(cnpj: str, filename: str) -> str:
    return f"/cnds/{cnpj}/{filename}"


async def _to_thread(func, *args, **kwargs):
    if hasattr(asyncio, "to_thread"):
        return await asyncio.to_thread(func, *args, **kwargs)
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: func(*args, **kwargs))


async def _wait_for_toast_message(page, timeout: int = 5000) -> Optional[str]:
    """Aguarda e captura mensagem de toast (geralmente erros)."""
    try:
        toast = await page.wait_for_selector(".toast-message", timeout=timeout)
        message = (await toast.inner_text() or "").strip()
        if message:
            print(f"[MEGASOFT] 🔔 Toast detectado: {message}")
            return message
    except PlaywrightTimeoutError:
        return None
    except Exception as exc:
        print(f"[MEGASOFT] ⚠️ Falha ao ler toast: {exc}")
    return None


def _classify_error_message(message: str) -> str:
    """Classifica e formata mensagens de erro de forma amigável."""
    if not message:
        return "Erro desconhecido ao processar a solicitação."
    
    message_lower = message.lower()
    
    # CNPJ/CPF não encontrado
    if "não encontrado" in message_lower or "nao encontrado" in message_lower:
        return "❌ CNPJ/CPF NÃO ENCONTRADO - O contribuinte não está cadastrado no município. Entre em contato com a Prefeitura para regularizar o cadastro."
    
    # Pendências/débitos
    if "pendência" in message_lower or "pendencia" in message_lower or "débito" in message_lower or "debito" in message_lower:
        return f"⚠️ PENDÊNCIA ENCONTRADA - {message}"
    
    # Outros erros conhecidos
    if "inválido" in message_lower or "invalido" in message_lower:
        return f"❌ DADO INVÁLIDO - {message}"
    
    # Retorna mensagem original se não identificada
    return f"⚠️ {message}"


async def _emitir_cnd_megasoft_impl(
    *,
    cnpj_digits: str,
    url: str,
    cidade: str,
    slug: str,
    destino: Path,
    filename: str,
    headless: bool,
) -> Dict[str, object]:
    print(f"[MEGASOFT] 🚀 Iniciando emissão para {cidade} ({slug})")
    print(f"[MEGASOFT] 🔗 URL: {url}")
    print(f"[MEGASOFT] 📋 CNPJ: {cnpj_digits}")

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
            executable_path = os.getenv("CND_CHROME_PATH")
            if executable_path:
                launch_args["executable_path"] = executable_path

            browser = await p.chromium.launch(**launch_args)
            context = await browser.new_context(accept_downloads=True, ignore_https_errors=True)
            page = await context.new_page()

            try:
                print("[MEGASOFT] 🌐 Carregando página...")
                await page.goto(url, wait_until="networkidle", timeout=30000)
                
                print("[MEGASOFT] 🔍 Selecionando tipo de contribuinte...")
                await page.wait_for_selector(".ng-select-container", timeout=20000)
                await page.locator(".ng-select-container").first.click()
                await page.wait_for_selector(
                    "span.ng-option-label:has-text(\"1 - Contribuinte\")",
                    timeout=20000,
                )
                await page.locator("span.ng-option-label:has-text(\"1 - Contribuinte\")").click()

                print("[MEGASOFT] ⌨️ Preenchendo CNPJ...")
                cnpj_input = page.locator("#cpfCnpj")
                await cnpj_input.wait_for(state="visible", timeout=20000)
                await cnpj_input.fill(cnpj_digits)
                await cnpj_input.press("Enter")

                print("[MEGASOFT] 🖱️ Clicando em 'GERAR CERTIDÃO'...")
                botao = page.locator("button.btn.btn-mega:has-text(\"GERAR CERTIDÃO\")")
                await botao.wait_for(state="visible", timeout=20000)
                
                # Inicia monitoramento de toast ANTES do clique
                toast_task = asyncio.create_task(_wait_for_toast_message(page, timeout=10000))
                
                # Clica no botão
                await botao.click()
                
                # Aguarda um curto período para toast aparecer (erros aparecem rápido)
                print("[MEGASOFT] ⏱️ Aguardando resposta do servidor...")
                await asyncio.sleep(1.5)
                
                # Verifica se toast já apareceu
                if toast_task.done():
                    mensagem = await toast_task
                    if mensagem:
                        erro_formatado = _classify_error_message(mensagem)
                        print(f"[MEGASOFT] ❌ Erro identificado: {erro_formatado}")
                        return {
                            "ok": False,
                            "info": erro_formatado,
                            "path": None,
                            "url": None,
                        }
                
                # Se não houve toast de erro, aguarda o download
                print("[MEGASOFT] 📥 Aguardando download...")
                download_task = asyncio.create_task(page.wait_for_event("download", timeout=20000))
                
                # Aguarda download OU toast (o que vier primeiro)
                done, pending = await asyncio.wait(
                    {download_task, toast_task},
                    return_when=asyncio.FIRST_COMPLETED,
                    timeout=25,
                )

                # Cancela tarefas pendentes
                for task in pending:
                    task.cancel()
                await asyncio.gather(*pending, return_exceptions=True)

                # Timeout geral
                if not done:
                    print("[MEGASOFT] ⏰ Timeout: nenhuma resposta do servidor")
                    return {
                        "ok": False,
                        "info": "⏰ TIMEOUT - O servidor não respondeu dentro do tempo esperado. Tente novamente.",
                        "path": None,
                        "url": None,
                    }

                # Identifica qual completou
                completed_task = done.pop()
                
                # Se toast completou primeiro = ERRO
                if completed_task == toast_task:
                    try:
                        mensagem = await toast_task
                        if mensagem:
                            erro_formatado = _classify_error_message(mensagem)
                            print(f"[MEGASOFT] ❌ Erro no toast: {erro_formatado}")
                            return {
                                "ok": False,
                                "info": erro_formatado,
                                "path": None,
                                "url": None,
                            }
                    except Exception as exc:
                        print(f"[MEGASOFT] ⚠️ Erro ao processar toast: {exc}")
                    
                    # Toast sem mensagem - situação indefinida
                    print("[MEGASOFT] ⚠️ Toast vazio detectado")
                    return {
                        "ok": False,
                        "info": "⚠️ ERRO INDEFINIDO - O servidor retornou uma resposta inesperada.",
                        "path": None,
                        "url": None,
                    }
                
                # Se download completou primeiro = SUCESSO
                try:
                    download = await download_task
                    print("[MEGASOFT] ✅ Download iniciado!")
                    
                    await download.save_as(str(destino))
                    caminho_absoluto = str(destino.resolve())
                    url_publica = _static_url(cnpj_digits, filename)
                    
                    print(f"[MEGASOFT] 💾 Certidão salva: {caminho_absoluto}")
                    return {
                        "ok": True,
                        "info": "✅ Certidão emitida com sucesso!",
                        "path": caminho_absoluto,
                        "url": url_publica,
                    }
                    
                except PlaywrightTimeoutError:
                    # Verifica se há toast de erro tardio
                    try:
                        if not toast_task.done():
                            mensagem = await asyncio.wait_for(toast_task, timeout=2.0)
                            if mensagem:
                                erro_formatado = _classify_error_message(mensagem)
                                print(f"[MEGASOFT] ❌ Erro tardio: {erro_formatado}")
                                return {
                                    "ok": False,
                                    "info": erro_formatado,
                                    "path": None,
                                    "url": None,
                                }
                    except Exception:
                        pass
                    
                    print("[MEGASOFT] ⏰ Timeout no download")
                    return {
                        "ok": False,
                        "info": "⏰ TIMEOUT NO DOWNLOAD - O arquivo não foi gerado no tempo esperado.",
                        "path": None,
                        "url": None,
                    }
                    
                except Exception as exc:
                    print(f"[MEGASOFT] ❌ Erro no download: {exc}")
                    return {
                        "ok": False,
                        "info": f"❌ ERRO NO DOWNLOAD - {str(exc)}",
                        "path": None,
                        "url": None,
                    }
                    
            finally:
                await context.close()
                await browser.close()
                
    except PlaywrightTimeoutError as exc:
        print(f"[MEGASOFT] ⏰ Timeout na navegação: {exc}")
        return {
            "ok": False,
            "info": "⏰ TIMEOUT - Tempo excedido ao acessar o portal. Verifique a conexão e tente novamente.",
            "path": None,
            "url": None,
        }
    except NotImplementedError:
        print("[MEGASOFT] ⚠️ Event loop incompatível, tentando fallback...")
        raise
    except Exception as exc:
        message = str(exc).strip()
        print(f"[MEGASOFT] ❌ Erro inesperado: {exc}")
        return {
            "ok": False,
            "info": f"❌ ERRO INESPERADO - {message or type(exc).__name__}",
            "path": None,
            "url": None,
        }


def _run_in_dedicated_event_loop(
    *,
    cnpj_digits: str,
    url: str,
    cidade: str,
    slug: str,
    destino: Path,
    filename: str,
    headless: bool,
) -> Dict[str, object]:
    """Executa o worker em um novo event loop (necessário no Windows)."""

    if sys.platform.startswith("win") and hasattr(asyncio, "WindowsProactorEventLoopPolicy"):
        policy = asyncio.WindowsProactorEventLoopPolicy()
    else:
        policy = asyncio.DefaultEventLoopPolicy()

    loop = policy.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(
            _emitir_cnd_megasoft_impl(
                cnpj_digits=cnpj_digits,
                url=url,
                cidade=cidade,
                slug=slug,
                destino=destino,
                filename=filename,
                headless=headless,
            )
        )
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
        except Exception:
            pass
        asyncio.set_event_loop(None)
        loop.close()


async def emitir_cnd_megasoft(
    cnpj: str,
    base_url: str,
    cidade: str,
    *,
    download_dir: Path,
    headless: bool = True,
) -> Dict[str, object]:
    """Emite CND no portal Megasoft e retorna o resultado padronizado."""

    cnpj_digits = _only_digits(cnpj)
    if len(cnpj_digits) != 14:
        return {
            "ok": False,
            "info": "❌ CNPJ INVÁLIDO - O CNPJ deve conter exatamente 14 dígitos.",
            "path": None,
            "url": None
        }

    url = _ensure_https(base_url)
    slug = _resolve_slug(url, cidade)
    destino_base = Path(download_dir)
    destino_dir = destino_base / cnpj_digits
    destino_dir.mkdir(parents=True, exist_ok=True)
    filename = _build_filename(slug)
    destino = destino_dir / filename

    should_use_thread = False
    if sys.platform.startswith("win"):
        try:
            running_loop = asyncio.get_running_loop()
            should_use_thread = running_loop.__class__.__name__.lower().startswith("selector")
        except RuntimeError:
            should_use_thread = True

    async def _run_direct():
        return await _emitir_cnd_megasoft_impl(
            cnpj_digits=cnpj_digits,
            url=url,
            cidade=cidade,
            slug=slug,
            destino=destino,
            filename=filename,
            headless=headless,
        )

    if should_use_thread:
        return await _to_thread(
            _run_in_dedicated_event_loop,
            cnpj_digits=cnpj_digits,
            url=url,
            cidade=cidade,
            slug=slug,
            destino=destino,
            filename=filename,
            headless=headless,
        )

    try:
        return await _run_direct()
    except NotImplementedError:
        if sys.platform.startswith("win"):
            return await _to_thread(
                _run_in_dedicated_event_loop,
                cnpj_digits=cnpj_digits,
                url=url,
                cidade=cidade,
                slug=slug,
                destino=destino,
                filename=filename,
                headless=headless,
            )
        raise