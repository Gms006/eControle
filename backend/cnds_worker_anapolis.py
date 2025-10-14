import sys
import asyncio
import subprocess
import platform
import base64
import time
import requests
import os
import re
from datetime import datetime
from typing import Optional, Tuple

from playwright.async_api import async_playwright

# CORREÇÃO: Configurar event loop ANTES de qualquer import do FastAPI
if sys.platform.startswith("win"):
    proactor_policy_cls = getattr(asyncio, "WindowsProactorEventLoopPolicy", None)
    if proactor_policy_cls is not None:
        try:
            policy = asyncio.get_event_loop_policy()
        except Exception:
            policy = None
        if not isinstance(policy, proactor_policy_cls):
            # Playwright exige ProactorEventLoop no Windows moderno
            asyncio.set_event_loop_policy(proactor_policy_cls())

MODO_HEADLESS = os.getenv("CND_HEADLESS", "false").lower() == "true"
EXECUTABLE_PATH = os.getenv("CND_CHROME_PATH")
SAIDA_BASE = os.getenv("CND_DIR_BASE", "certidoes")
CAPTCHA_MODE = (os.getenv("CAPTCHA_MODE") or "manual").lower().strip()
API_KEY_2CAPTCHA = os.getenv("API_KEY_2CAPTCHA", "").strip()


def only_digits(s: str) -> str:
    return re.sub(r"\D+", "", s or "")


def _nome_arquivo_destino() -> str:
    return f"CND - {datetime.now().strftime('%d.%m.%Y')}.pdf"


async def _abrir_portal(page) -> None:
    # navega pela HOME + menu, garantindo a tela certa (como no script base)
    await page.goto("https://portaldocidadao.anapolis.go.gov.br/", wait_until="domcontentloaded")
    await page.wait_for_load_state("networkidle")
    try:
        await page.hover("a.pure-menu-link:text('Certidões')")
        await page.wait_for_selector("a.pure-menu-link[data-navigation='7021']", timeout=10000)
        await page.click("a.pure-menu-link[data-navigation='7021']")
        await page.wait_for_load_state("networkidle")
    except Exception:
        # fallback: se o menu mudar, ainda assim tenta a rota /processos/
        await page.goto("https://portaldocidadao.anapolis.go.gov.br/processos/", wait_until="domcontentloaded")
        await page.wait_for_load_state("networkidle")


async def _preencher_cnpj(page, cnpj: str) -> bool:
    candidatos = [
        "input[name*='cnpj']",
        "input[id*='cnpj']",
        "input[placeholder*='CNPJ' i]",
        "input[type='text']",
    ]
    for css in candidatos:
        loc = page.locator(css)
        if await loc.count():
            try:
                await loc.first.fill(cnpj)
                await loc.first.dispatch_event("input")
                await loc.first.dispatch_event("change")
                return True
            except Exception:
                pass
    return False


async def _clicar_consultar(page) -> None:
    ok = await page.evaluate(
        """
      () => {
        const btns = [...document.querySelectorAll('button,input[type="button"],input[type="submit"]')];
        const b = btns.find(b => (b.value||b.textContent||'').toLowerCase().includes('consultar'));
        if (b) { b.click(); return true; }
        return false;
      }
    """
    )
    if not ok:
        await page.keyboard.press("Enter")


def _solve_image_captcha_2captcha(image_b64: str) -> str:
    if not API_KEY_2CAPTCHA:
        raise RuntimeError("API_KEY_2CAPTCHA ausente.")
    response = requests.post(
        "http://2captcha.com/in.php",
        data={"method": "base64", "key": API_KEY_2CAPTCHA, "body": image_b64, "json": 1},
        timeout=30,
    ).json()
    if response.get("status") != 1:
        raise RuntimeError(f"2Captcha falhou (in): {response}")
    captcha_id = response["request"]
    for _ in range(24):
        time.sleep(5)
        result = requests.get(
            "http://2captcha.com/res.php",
            params={"key": API_KEY_2CAPTCHA, "action": "get", "id": captcha_id, "json": 1},
            timeout=30,
        ).json()
        if result.get("status") == 1:
            return result["request"]
    raise TimeoutError("Timeout 2Captcha (imagem).")


# Verificar e instalar dependências do Playwright se necessário
def _check_playwright_deps():
    try:
        import playwright
        try:
            # Tenta instalar as dependências do browser se ainda não instaladas
            subprocess.run(
                [sys.executable, "-m", "playwright", "install", "chromium"],
                capture_output=True,
                check=True,
            )
        except subprocess.CalledProcessError:
            print("AVISO: Falha ao instalar dependências do Playwright automaticamente.")
    except ImportError:
        print("ERRO: Playwright não instalado. Execute: pip install playwright")
        return False
    return True


# Configuração específica para Windows
if platform.system() == "Windows":
    # Força ProactorEventLoop no Windows
    if isinstance(asyncio.get_event_loop_policy(), asyncio.WindowsSelectorEventLoopPolicy):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    # Garante que o event loop está configurado
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)


async def emitir_cnd_anapolis(cnpj: str) -> Tuple[bool, str, Optional[str]]:
    if sys.platform.startswith("win"):
        selector_loop_cls = getattr(asyncio, "SelectorEventLoop", None)
        proactor_policy_cls = getattr(asyncio, "WindowsProactorEventLoopPolicy", None)
        if selector_loop_cls is not None and proactor_policy_cls is not None:
            try:
                running_loop = asyncio.get_running_loop()
            except RuntimeError:
                running_loop = None
            else:
                # FastAPI/Uvicorn força WindowsSelectorEventLoopPolicy por compatibilidade,
                # mas o Playwright precisa do ProactorEventLoop para spawnar o Chromium.
                if isinstance(running_loop, selector_loop_cls):
                    loop = running_loop

                    def _runner() -> Tuple[bool, str, Optional[str]]:
                        previous_policy = None
                        try:
                            previous_policy = asyncio.get_event_loop_policy()
                        except Exception:
                            pass
                        asyncio.set_event_loop_policy(proactor_policy_cls())
                        try:
                            return asyncio.run(_emitir_cnd_anapolis_impl(cnpj))
                        finally:
                            if previous_policy is not None:
                                asyncio.set_event_loop_policy(previous_policy)

                    return await loop.run_in_executor(None, _runner)

    return await _emitir_cnd_anapolis_impl(cnpj)


async def _emitir_cnd_anapolis_impl(cnpj: str) -> Tuple[bool, str, Optional[str]]:
    # Verificar dependências primeiro
    if not _check_playwright_deps():
        return False, "Playwright não instalado corretamente.", None

    cnpj = only_digits(cnpj)
    os.makedirs(SAIDA_BASE, exist_ok=True)
    destino_dir = os.path.join(SAIDA_BASE, cnpj)
    os.makedirs(destino_dir, exist_ok=True)
    destino = os.path.join(destino_dir, _nome_arquivo_destino())

    try:
        async with async_playwright() as p:
            launch_args = {
                "headless": MODO_HEADLESS,
                "args": [
                    "--disable-gpu",
                    "--disable-dev-shm-usage",
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--no-sandbox",  # Adiciona esta opção
                ],
            }
            if EXECUTABLE_PATH:
                launch_args["executable_path"] = EXECUTABLE_PATH
            try:
                browser = await p.chromium.launch(**launch_args)
            except Exception as exc:
                return False, f"Falha ao iniciar Chromium ({type(exc).__name__}): {exc}", None
            context = await browser.new_context(ignore_https_errors=True)
            page = await context.new_page()
            try:
                await _abrir_portal(page)
                try:
                    await page.locator(
                        "span.select2-chosen, .select2-selection__rendered, [class*='select2']"
                    ).first.click()
                    await page.wait_for_timeout(500)
                    for sel in [
                        "li:has-text(\"CNPJ\")",
                        ".select2-results__option:has-text(\"CNPJ\")",
                    ]:
                        if await page.locator(sel).count():
                            await page.locator(sel).first.click()
                            break
                except Exception:
                    pass

                if not await _preencher_cnpj(page, cnpj):
                    return False, "Campo de CNPJ não encontrado.", None

                solved = False
                try:
                    img = page.locator('img[src*="captcha"]').first
                    if await img.count():
                        if CAPTCHA_MODE == "image_2captcha" and API_KEY_2CAPTCHA:
                            png_bytes = await img.screenshot(type="png")
                            b64 = base64.b64encode(png_bytes).decode()
                            answer = _solve_image_captcha_2captcha(b64)
                            candidatos = [
                                "input[name*='captcha']",
                                "input[id*='captcha']",
                                "input[placeholder*='captcha' i]",
                                "input[type='text']",
                            ]
                            for css in candidatos:
                                loc = page.locator(css)
                                if await loc.count():
                                    try:
                                        await loc.first.fill(answer)
                                        await loc.first.dispatch_event("input")
                                        await loc.first.dispatch_event("change")
                                        solved = True
                                        break
                                    except Exception:
                                        continue
                except Exception:
                    pass

                if not solved:
                    await page.bring_to_front()

                await _clicar_consultar(page)
                await page.wait_for_load_state("networkidle", timeout=30000)
                await page.wait_for_timeout(1500)

                # --- SweetAlert de erro de captcha (igual ao script base) ---
                try:
                    popup = page.locator("div.swal2-popup:has-text('O código de verificação não confere')")
                    if await popup.count() > 0:
                        try:
                            await page.click(".swal2-confirm")
                        except Exception:
                            pass
                        return False, "Captcha inválido: o código de verificação não confere.", None
                except Exception:
                    pass

                # 1) Tenta clicar em elementos de download/imprimir/gerar
                tried = await page.evaluate(
                    """
                  () => {
                    const Q = (s)=>[...document.querySelectorAll(s)];
                    const hits = [...Q('a[href$=".pdf"]'), ...Q('a[href*="download"]'),
                                  ...Q('button[title*="Download" i]'), ...Q('i[class*="download" i]')];
                    if (hits.length) { hits[0].click(); return true; }
                    const any = [...Q('a,button')].find(el => /pdf|imprimir|gerar/i.test(el.textContent||''));
                    if (any) { any.click(); return true; }
                    return false;
                  }
                """
                )
                if tried:
                    # 2) Se clicar disparar um "download event", ótimo:
                    try:
                        async with page.expect_download(timeout=15000) as di:
                            download = await di.value
                            await download.save_as(destino)
                        return True, "CND emitida com sucesso.", destino
                    except Exception:
                        # 3) Se NÃO houve 'download', pode ter aberto em NOVA ABA ou inline (PDF viewer)
                        pass

                # 4) Captura de NOVA PÁGINA com PDF (target=_blank)
                new_page = None
                try:
                    new_page = await page.context.wait_for_event("page", timeout=5000)
                    await new_page.wait_for_load_state("domcontentloaded", timeout=10000)
                except Exception:
                    new_page = None

                candidate_page = new_page or page
                url_now = candidate_page.url or ""
                if url_now.lower().endswith(".pdf"):
                    try:
                        # Baixa usando a própria API de requests do Playwright (mantém cookies/sessão)
                        resp = await candidate_page.request.get(url_now)
                        if resp.ok:
                            content = await resp.body()
                            os.makedirs(os.path.dirname(destino), exist_ok=True)
                            with open(destino, "wb") as f:
                                f.write(content)
                            return True, "CND emitida com sucesso (inline).", destino
                    except Exception:
                        pass

                # 5) Às vezes o PDF está embedado em <iframe>/<embed>
                try:
                    pdf_src = await candidate_page.evaluate("""
                      () => {
                        const fr = document.querySelector('iframe, embed');
                        if (!fr) return null;
                        const src = fr.getAttribute('src') || fr.src;
                        return (src && /\.pdf(\?|$)/i.test(src)) ? src : null;
                      }
                    """)
                    if pdf_src:
                        resp = await candidate_page.request.get(pdf_src)
                        if resp.ok:
                            content = await resp.body()
                            os.makedirs(os.path.dirname(destino), exist_ok=True)
                            with open(destino, "wb") as f:
                                f.write(content)
                            return True, "CND emitida com sucesso (iframe).", destino
                except Exception:
                    pass

                return False, "Botão/link de PDF não identificado (nem inline/nova aba).", None
            finally:
                await context.close()
                await browser.close()
    except NotImplementedError:
        return (
            False,
            "Automação indisponível neste sistema (Playwright não suportado). Utilize o fallback manual.",
            None,
        )
    except Exception as exc:
        return False, f"Falha inesperada na automação: {exc}", None
