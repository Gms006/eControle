"""Rotina Playwright para emissão da CAE/FIC no portal de Anápolis."""
from __future__ import annotations

import asyncio
import base64
import os
import platform
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

import requests
from dotenv import find_dotenv, load_dotenv
from playwright.async_api import (
    Page,
    TimeoutError as PlaywrightTimeoutError,
    async_playwright,
)

# ---------------------------------------------------------------------------
# Carregamento antecipado do .env e ajuste de event loop (Windows)
# ---------------------------------------------------------------------------
_DOTENV_PATH = find_dotenv(filename=".env", raise_error_if_not_found=False)
if not _DOTENV_PATH:
    base_dir = Path(__file__).resolve().parent
    for candidate in (base_dir / ".env", base_dir.parent / ".env"):
        if candidate.exists():
            _DOTENV_PATH = str(candidate)
            break
load_dotenv(dotenv_path=_DOTENV_PATH or None)

if sys.platform.startswith("win"):
    proactor_policy_cls = getattr(asyncio, "WindowsProactorEventLoopPolicy", None)
    if proactor_policy_cls is not None:
        try:
            current_policy = asyncio.get_event_loop_policy()
        except Exception:  # pragma: no cover - defensive
            current_policy = None
        if not isinstance(current_policy, proactor_policy_cls):
            asyncio.set_event_loop_policy(proactor_policy_cls())

# ---------------------------------------------------------------------------
# Configurações de ambiente compartilhadas com os workers de CND
# ---------------------------------------------------------------------------
EXECUTABLE_PATH = os.getenv("CND_CHROME_PATH")
SAIDA_BASE = Path(os.getenv("CND_DIR_BASE", "certidoes"))
CAPTCHA_MODE = (os.getenv("CAPTCHA_MODE") or "manual").strip().lower()
API_KEY_2CAPTCHA = (os.getenv("API_KEY_2CAPTCHA") or "").strip()

PORTAL_CIDADAO_URL = "https://portaldocidadao.anapolis.go.gov.br/"


def only_digits(s: str) -> str:
    """Retorna apenas os dígitos de uma string."""
    return re.sub(r"\D+", "", s or "")


def normalize_im(raw: str) -> str:
    """Normaliza a inscrição municipal (IM) removendo sufixos e não dígitos."""
    base = (raw or "").split(" - ")[0]
    return only_digits(base)


# ---------------------------------------------------------------------------
# Utilidades internas
# ---------------------------------------------------------------------------

def _nome_arquivo_destino() -> str:
    return f"CAE - {datetime.now().strftime('%d.%m.%Y')}.pdf"


def _check_playwright_deps() -> bool:
    """Garante que o Playwright e o Chromium estejam instalados."""
    try:
        import playwright  # noqa: F401
    except ImportError:
        return False

    try:
        subprocess.run(
            [sys.executable, "-m", "playwright", "install", "chromium"],
            capture_output=True,
            check=True,
        )
    except subprocess.CalledProcessError:
        # Caso já esteja instalado ou não seja necessário reinstalar
        pass
    return True


def _solve_image_captcha_2captcha(image_b64: str) -> str:
    if not API_KEY_2CAPTCHA:
        raise RuntimeError("API_KEY_2CAPTCHA não configurada para resolução automática do captcha.")

    response = requests.post(
        "http://2captcha.com/in.php",
        data={"method": "base64", "key": API_KEY_2CAPTCHA, "body": image_b64, "json": 1},
        timeout=30,
    ).json()
    if response.get("status") != 1:
        raise RuntimeError(f"2Captcha falhou ao receber imagem: {response}")

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
    raise TimeoutError("Timeout aguardando resposta do 2Captcha.")


async def _resolver_captcha(page: Page) -> bool:
    """Tenta resolver o captcha automaticamente. Retorna True se preenchido."""
    img = page.locator("img.step-img[src*='captcha.action']").first
    if not await img.count():
        return True

    try:
        await page.locator("#106270").wait_for(state="visible", timeout=10000)
    except PlaywrightTimeoutError:
        pass

    if CAPTCHA_MODE == "image_2captcha" and API_KEY_2CAPTCHA:
        png_bytes = await img.screenshot(type="png")
        b64 = base64.b64encode(png_bytes).decode()
        resposta = _solve_image_captcha_2captcha(b64)
        input_captcha = page.locator("#106270")
        await input_captcha.fill(resposta)
        return True

    return False


async def _abrir_menu_certidoes(
    page: Page, submenu_selector: str, tentativas: int = 3
) -> bool:
    """Tenta abrir o submenu "Certidões" e clicar na opção desejada."""

    try:
        menu_certidoes = page.locator("a.pure-menu-link", has_text="Certidões").first
        await menu_certidoes.wait_for(state="visible", timeout=5000)
    except Exception:
        return False

    submenu_opcao = page.locator(submenu_selector).first
    if not await submenu_opcao.count():
        return False

    for tentativa in range(max(tentativas, 1)):
        try:
            await menu_certidoes.scroll_into_view_if_needed()
        except Exception:
            pass

        try:
            await menu_certidoes.click()
        except Exception:
            try:
                await menu_certidoes.hover()
                await menu_certidoes.click()
            except Exception:
                pass

        try:
            await submenu_opcao.wait_for(state="visible", timeout=4000)
        except PlaywrightTimeoutError:
            try:
                await menu_certidoes.hover()
                await submenu_opcao.wait_for(state="visible", timeout=4000)
            except Exception:
                pass
        except Exception:
            pass

        try:
            if await submenu_opcao.is_visible():
                await submenu_opcao.scroll_into_view_if_needed()
                await submenu_opcao.click()
                return True
        except Exception:
            pass

        if tentativa < tentativas - 1:
            await page.wait_for_timeout(500)

    return False


async def _navegar_para_formulario(page: Page) -> None:
    await page.goto(PORTAL_CIDADAO_URL, wait_until="domcontentloaded")
    try:
        await page.wait_for_load_state("networkidle", timeout=15000)
    except PlaywrightTimeoutError:
        pass

    acesso_realizado = False
    try:
        acesso_realizado = await _abrir_menu_certidoes(
            page, "a.pure-menu-link[data-navigation='7023']"
        )
        if acesso_realizado:
            try:
                await page.wait_for_load_state("networkidle", timeout=15000)
            except PlaywrightTimeoutError:
                pass
    except Exception:
        acesso_realizado = False

    if not acesso_realizado:
        # Como fallback, tenta recarregar a página inicial do portal e repetir o fluxo
        try:
            await page.goto(PORTAL_CIDADAO_URL, wait_until="domcontentloaded")
            try:
                await page.wait_for_load_state("networkidle", timeout=15000)
            except PlaywrightTimeoutError:
                pass
            acesso_realizado = await _abrir_menu_certidoes(
                page, "a.pure-menu-link[data-navigation='7023']"
            )
            if acesso_realizado:
                try:
                    await page.wait_for_load_state("networkidle", timeout=15000)
                except PlaywrightTimeoutError:
                    pass
        except Exception:
            pass

    await page.wait_for_selector("#106266", state="visible", timeout=15000)


async def _preencher_im(page: Page, im: str) -> None:
    campo_im = page.locator("#106266")
    await campo_im.fill("")
    await campo_im.type(im)


async def _clicar_emitir(page: Page) -> None:
    botao_emitir = page.locator("input.botao[acao='106274']").first
    await botao_emitir.wait_for(state="visible", timeout=15000)
    await botao_emitir.click()


async def _aguardar_download(page: Page, destino: Path) -> None:
    anexos = page.locator("#anexos-linhas-arquivos-106272 a[href*='downloadanexo.action']").first
    await anexos.wait_for(state="visible", timeout=30000)
    if destino.exists():
        destino.unlink()
    async with page.expect_download(timeout=30000) as download_info:
        await anexos.click()
    download = await download_info.value
    await download.save_as(str(destino))


async def _emitir_cae_anapolis_impl(cnpj: str, im: str) -> Dict:
    if not _check_playwright_deps():
        return {
            "ok": False,
            "info": "Playwright/Chromium não instalados. Configure o ambiente antes de emitir a CAE.",
            "path": None,
            "url": None,
        }

    cnpj_digits = only_digits(cnpj)
    im_digits = normalize_im(im)
    if len(cnpj_digits) != 14:
        return {
            "ok": False,
            "info": "CNPJ inválido (14 dígitos).",
            "path": None,
            "url": None,
        }
    if not im_digits:
        return {
            "ok": False,
            "info": "Inscrição Municipal inválida.",
            "path": None,
            "url": None,
        }

    SAIDA_BASE.mkdir(parents=True, exist_ok=True)
    destino_dir = SAIDA_BASE / cnpj_digits
    destino_dir.mkdir(parents=True, exist_ok=True)
    filename = _nome_arquivo_destino()
    destino = destino_dir / filename
    url_relativo = f"/cnds/{cnpj_digits}/{filename}"

    headless = (os.getenv("CND_HEADLESS", "false").strip().lower() in {"1", "true", "yes", "on"})

    try:
        async with async_playwright() as p:
            launch_args = {
                "headless": headless,
                "args": [
                    "--disable-gpu",
                    "--disable-dev-shm-usage",
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--no-sandbox",
                ],
            }
            if EXECUTABLE_PATH:
                launch_args["executable_path"] = EXECUTABLE_PATH
            try:
                browser = await p.chromium.launch(**launch_args)
            except Exception as exc:
                return {
                    "ok": False,
                    "info": f"Falha ao iniciar Chromium ({type(exc).__name__}): {exc}",
                    "path": None,
                    "url": None,
                }

            context = await browser.new_context(ignore_https_errors=True, accept_downloads=True)
            page = await context.new_page()

            try:
                await _navegar_para_formulario(page)
                await _preencher_im(page, im_digits)

                captcha_preenchido = await _resolver_captcha(page)
                if not captcha_preenchido:
                    if headless:
                        return {
                            "ok": False,
                            "info": "Captcha não resolvido automaticamente. Configure o 2Captcha para execução headless.",
                            "path": None,
                            "url": None,
                        }
                    try:
                        await page.wait_for_function(
                            "document.querySelector('#106270') && document.querySelector('#106270').value.trim().length > 0",
                            timeout=120000,
                        )
                    except PlaywrightTimeoutError:
                        return {
                            "ok": False,
                            "info": "Captcha não foi preenchido manualmente a tempo.",
                            "path": None,
                            "url": None,
                        }

                await _clicar_emitir(page)

                try:
                    await page.wait_for_load_state("networkidle", timeout=30000)
                except PlaywrightTimeoutError:
                    pass

                try:
                    popup = page.locator("div.swal2-popup:has-text('não confere')")
                    if await popup.count():
                        try:
                            await page.locator(".swal2-confirm").click()
                        except Exception:
                            pass
                        return {
                            "ok": False,
                            "info": "Captcha inválido informado no portal.",
                            "path": None,
                            "url": None,
                        }
                except Exception:
                    pass

                try:
                    await _aguardar_download(page, destino)
                except PlaywrightTimeoutError:
                    return {
                        "ok": False,
                        "info": "Aguardando disponibilidade do arquivo da CAE (timeout).",
                        "path": None,
                        "url": None,
                    }
                except Exception as exc:
                    return {
                        "ok": False,
                        "info": f"Falha ao baixar a CAE: {exc}",
                        "path": None,
                        "url": None,
                    }

                return {
                    "ok": True,
                    "info": "CAE emitida com sucesso.",
                    "path": str(destino),
                    "url": url_relativo,
                }
            finally:
                await context.close()
                await browser.close()
    except NotImplementedError:
        return {
            "ok": False,
            "info": "Automação indisponível neste sistema (Playwright não suportado).",
            "path": None,
            "url": None,
        }
    except Exception as exc:
        return {
            "ok": False,
            "info": f"Falha inesperada na automação: {exc}",
            "path": None,
            "url": None,
        }


async def emitir_cae_anapolis(cnpj: str, im: str) -> Dict:
    """Emite e baixa a CAE/FIC no portal de Anápolis usando a IM."""
    if sys.platform.startswith("win"):
        selector_loop_cls = getattr(asyncio, "SelectorEventLoop", None)
        proactor_policy_cls = getattr(asyncio, "WindowsProactorEventLoopPolicy", None)
        if selector_loop_cls is not None and proactor_policy_cls is not None:
            try:
                running_loop = asyncio.get_running_loop()
            except RuntimeError:
                running_loop = None
            else:
                if isinstance(running_loop, selector_loop_cls):
                    loop = running_loop

                    def _runner() -> Dict:
                        previous_policy: Optional[asyncio.AbstractEventLoopPolicy] = None
                        try:
                            previous_policy = asyncio.get_event_loop_policy()
                        except Exception:
                            pass
                        asyncio.set_event_loop_policy(proactor_policy_cls())
                        try:
                            return asyncio.run(_emitir_cae_anapolis_impl(cnpj, im))
                        finally:
                            if previous_policy is not None:
                                asyncio.set_event_loop_policy(previous_policy)

                    return await loop.run_in_executor(None, _runner)

    return await _emitir_cae_anapolis_impl(cnpj, im)

