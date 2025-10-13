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
    # Força o uso do SelectorEventLoop no Windows, que é compatível com Playwright
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

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
    await page.goto(
        "https://portaldocidadao.anapolis.go.gov.br/processos/",
        wait_until="domcontentloaded",
    )
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
                await page.wait_for_timeout(1000)

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
                if not tried:
                    return False, "Botão/link de PDF não identificado.", None

                async with page.expect_download(timeout=30000) as di:
                    download = await di.value
                    await download.save_as(destino)
                return True, "CND emitida com sucesso.", destino
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
