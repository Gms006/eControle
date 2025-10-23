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

from pathlib import Path
from dotenv import load_dotenv, find_dotenv
from playwright.async_api import async_playwright

# Garante que variáveis do .env estejam disponíveis antes de qualquer uso
_DOTENV_PATH = find_dotenv(filename=".env", raise_error_if_not_found=False)
if not _DOTENV_PATH:
    base_dir = Path(__file__).resolve().parent
    for candidate in (base_dir / ".env", base_dir.parent / ".env"):
        if candidate.exists():
            _DOTENV_PATH = str(candidate)
            break
load_dotenv(dotenv_path=_DOTENV_PATH or None)

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

EXECUTABLE_PATH = os.getenv("CND_CHROME_PATH")
SAIDA_BASE = os.getenv("CND_DIR_BASE", "certidoes")
CAPTCHA_MODE = (os.getenv("CAPTCHA_MODE") or "manual").lower().strip()
API_KEY_2CAPTCHA = os.getenv("API_KEY_2CAPTCHA", "").strip()


def only_digits(s: str) -> str:
    return re.sub(r"\D+", "", s or "")


def _nome_arquivo_destino() -> str:
    return f"CND - {datetime.now().strftime('%d.%m.%Y')}.pdf"


async def _abrir_portal(page) -> None:
    # Fluxo validado no seu script base:
    await page.goto("https://portaldocidadao.anapolis.go.gov.br/", wait_until="domcontentloaded")
    await page.wait_for_load_state("networkidle")
    try:
        # menu "Certidões" → item com data-navigation="7021"
        await page.hover("a.pure-menu-link:text('Certidões')")
        await page.wait_for_selector("a.pure-menu-link[data-navigation='7021']", timeout=10000)
        await page.click("a.pure-menu-link[data-navigation='7021']")
        await page.wait_for_load_state("networkidle")
    except Exception:
        # fallback, se o menu mudar temporariamente
        await page.goto("https://portaldocidadao.anapolis.go.gov.br/", wait_until="domcontentloaded")
        await page.wait_for_load_state("networkidle")


async def _preencher_cnpj(page, cnpj: str) -> bool:
    """
    Preenche o campo CNPJ após selecionar a opção CNPJ no dropdown Select2.
    Retorna True se conseguiu preencher, False caso contrário.
    """
    # 1) Selecionar "CNPJ" no Select2 - baseado no script funcional
    try:
        # Clicar diretamente no dropdown visível (igual ao script base)
        await page.locator('span.select2-chosen, .select2-selection__rendered, [class*="select2"]:visible').first.click()
        await page.wait_for_timeout(1000)  # Aguardar a reação do dropdown
        
        # Tentar clicar na opção CNPJ (mesma ordem do script base)
        cnpj_options = [
            'li:has-text("CNPJ")',
            '.select2-results__option:has-text("CNPJ")', 
            'div.select2-result-label:has-text("CNPJ")', 
            'div:has-text("CNPJ")'
        ]
        
        cnpj_selected = False
        for option in cnpj_options:
            try:
                if await page.locator(option).count() > 0:
                    await page.locator(option).first.click()
                    print("[CONFIG] Opção CNPJ selecionada com sucesso.")
                    cnpj_selected = True
                    break
            except Exception as e:
                print(f"[DEBUG] Erro ao selecionar opção CNPJ {option}: {str(e)}")
        
        if not cnpj_selected:
            print("[AVISO] Não conseguiu clicar na opção CNPJ")
            
    except Exception as e:
        print(f"[AVISO] Erro ao selecionar CNPJ no dropdown: {e}")

    # 2) Aguardar para garantir que a interface foi atualizada (igual ao script base)
    await page.wait_for_timeout(2000)

    # 3) Localizar e preencher o campo CNPJ via JavaScript (EXATAMENTE como no script base)
    ok = await page.evaluate(
        """(cnpj) => {
            // Tentar encontrar o campo correto para CNPJ
            const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
            let cnpjInput = null;
            
            // Procurar por input que pareça ser para CNPJ
            for (const input of inputs) {
                // Verificar por atributos ou elementos próximos
                if (input.placeholder && (input.placeholder.includes('CNPJ') || input.placeholder.includes('Informe'))) {
                    cnpjInput = input;
                    break;
                }
                
                // Verificar maxlength (CNPJ geralmente tem 18 caracteres com formatação)
                if (input.maxLength >= 14 && input.maxLength <= 18) {
                    cnpjInput = input;
                }
            }
            
            // Se encontramos um input, preenchê-lo
            if (cnpjInput) {
                cnpjInput.focus();
                cnpjInput.value = cnpj;
                
                // Disparar eventos para garantir que o sistema reconheça a alteração
                cnpjInput.dispatchEvent(new Event('input', { bubbles: true }));
                cnpjInput.dispatchEvent(new Event('change', { bubbles: true }));
                
                return true;
            }
            
            return false;
        }""",
        cnpj,
    )
    
    if ok:
        print(f"[CONFIG] CNPJ {cnpj} preenchido no formulário")
        return True
    
    # 4) Fallback usando seletores Playwright (só se o JavaScript falhar)
    for sel in ['input[name*="cnpj" i]','input[id*="cnpj" i]','input[placeholder*="CNPJ" i]']:
        loc = page.locator(sel).first
        if await loc.count():
            try:
                await loc.fill(cnpj)
                await loc.dispatch_event("input")
                await loc.dispatch_event("change")
                print(f"[OK] Campo CNPJ preenchido usando seletor: {sel}")
                return True
            except Exception:
                pass
    
    print("[ERRO] Não foi possível encontrar ou preencher o campo CNPJ")
    return False

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


async def emitir_cnd_anapolis(cnpj: str) -> Tuple[bool, str, Optional[str], Optional[str]]:
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

                    def _runner() -> Tuple[bool, str, Optional[str], Optional[str]]:
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


async def _emitir_cnd_anapolis_impl(cnpj: str) -> Tuple[bool, str, Optional[str], Optional[str]]:
    """Implementação da emissão de CND - VERSÃO CORRIGIDA"""
    # Verificar dependências primeiro
    if not _check_playwright_deps():
        return False, "Playwright não instalado corretamente.", None, None

    cnpj = only_digits(cnpj)
    os.makedirs(SAIDA_BASE, exist_ok=True)
    destino_dir = os.path.join(SAIDA_BASE, cnpj)
    os.makedirs(destino_dir, exist_ok=True)
    filename = _nome_arquivo_destino()
    destino = os.path.join(destino_dir, filename)
    url_relativo = f"/cnds/{cnpj}/{filename}"

    try:
        async with async_playwright() as p:
            # LER headless no runtime (não no import)
            headless = (os.getenv("CND_HEADLESS", "false").lower() == "true")
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
            print(f"[CND] headless={launch_args['headless']} (CND_HEADLESS={os.getenv('CND_HEADLESS')})")
            
            try:
                browser = await p.chromium.launch(**launch_args)
            except Exception as exc:
                return False, f"Falha ao iniciar Chromium ({type(exc).__name__}): {exc}", None, None
            
            context = await browser.new_context(ignore_https_errors=True)
            page = await context.new_page()
            
            try:
                # Abrir portal
                await _abrir_portal(page)
                
                # CORREÇÃO: Aguardar elementos VISÍVEIS, não hidden
                # Remover o wait_for_selector problemático e usar uma abordagem mais robusta
                print("[INFO] Aguardando página de certidão carregar...")
                await page.wait_for_load_state("domcontentloaded")
                await page.wait_for_timeout(3000)  # Tempo para a página renderizar completamente
                
                # Verificar se chegamos na página correta procurando pelo Select2
                try:
                    await page.wait_for_selector('span.select2-chosen:visible, .select2-choice:visible', timeout=10000)
                    print("[INFO] Página de certidão carregada com sucesso")
                except Exception as e:
                    print(f"[AVISO] Select2 não encontrado, tentando continuar: {e}")

                # Preencher CNPJ
                if not await _preencher_cnpj(page, cnpj):
                    return False, "Campo de CNPJ não encontrado ou não preenchido.", None, None

                # Resolver captcha
                solved = False
                try:
                    img = page.locator('img[src*="captcha"]').first
                    if await img.count():
                        if CAPTCHA_MODE == "image_2captcha" and API_KEY_2CAPTCHA:
                            png_bytes = await img.screenshot(type="png")
                            b64 = base64.b64encode(png_bytes).decode()
                            answer = _solve_image_captcha_2captcha(b64)
                            
                            # Preencher captcha usando a mesma lógica do script base
                            captcha_input_found = await page.evaluate(
                                """(resposta) => {
                                    const img = document.querySelector('img[src*="captcha"]');
                                    if (!img) return false;

                                    const candidates = Array.from(document.querySelectorAll('input[type="text"]')).filter(i => !i.value);
                                    const imgRect = img.getBoundingClientRect();

                                    for (const input of candidates) {
                                        const rect = input.getBoundingClientRect();
                                        const nearVertically = rect.top >= imgRect.top - 50 && rect.top <= imgRect.bottom + 50;
                                        const nearHorizontally = Math.abs(rect.left - imgRect.left) < 300;
                                        if (nearVertically && nearHorizontally) {
                                            input.focus();
                                            input.value = resposta;
                                            input.dispatchEvent(new Event('input', { bubbles: true }));
                                            input.dispatchEvent(new Event('change', { bubbles: true }));
                                            return true;
                                        }
                                    }

                                    if (candidates.length > 0) {
                                        const input = candidates[0];
                                        input.focus();
                                        input.value = resposta;
                                        input.dispatchEvent(new Event('input', { bubbles: true }));
                                        input.dispatchEvent(new Event('change', { bubbles: true }));
                                        return true;
                                    }
                                    return false;
                                }""",
                                answer
                            )
                            
                            if captcha_input_found:
                                solved = True
                                print("[CONFIG] CAPTCHA preenchido automaticamente")
                            else:
                                print("[AVISO] Não foi possível preencher o CAPTCHA automaticamente")
                except Exception as e:
                    print(f"[DEBUG] Erro ao processar captcha: {e}")

                if not solved:
                    print("[INFO] Aguardando resolução manual do CAPTCHA...")
                    await page.bring_to_front()

                # Clicar no botão Consultar (usando lógica do script base)
                await page.evaluate("""
                    () => {
                        const buttons = Array.from(document.querySelectorAll('input[type="button"], button'));
                        for (const btn of buttons) {
                            if ((btn.value && btn.value.includes('Consultar')) || 
                                (btn.textContent && btn.textContent.includes('Consultar'))) {
                                btn.click();
                                return true;
                            }
                        }
                        return false;
                    }
                """)
                
                print("[CONFIG] Aguardando carregamento da certidão...")
                await page.wait_for_load_state("networkidle", timeout=30000)

                # Verificar popup de erro de captcha (igual ao script base)
                try:
                    popup = page.locator("div.swal2-popup:has-text('O código de verificação não confere')")
                    if await popup.count() > 0:
                        try:
                            await page.click('.swal2-confirm')
                        except Exception:
                            pass
                        return False, "Captcha inválido: o código de verificação não confere.", None, None
                except Exception:
                    pass

                # Esperar um tempo adicional
                await page.wait_for_timeout(5000)

                # Detectar e clicar no ícone de download (EXATAMENTE como no script base)
                download_click_success = await page.evaluate("""
                    () => {
                        // Procurar todos os elementos que possam ser botões de download
                        const downloadElements = [
                            ...document.querySelectorAll('img[src*="download"]'),
                            ...document.querySelectorAll('a[href*="download"]'),
                            ...document.querySelectorAll('button[title*="Download"]'),
                            ...document.querySelectorAll('i[class*="download"]')
                        ];
                        
                        if (downloadElements.length > 0) {
                            downloadElements[0].click();
                            return true;
                        }
                        
                        // Procurar qualquer elemento que tenha 'download' em seu conteúdo
                        const elements = document.evaluate(
                            "//*[contains(@src, 'download') or contains(@href, 'download') or contains(@class, 'download') or contains(@title, 'download')]",
                            document,
                            null,
                            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                            null
                        );
                        
                        if (elements.snapshotLength > 0) {
                            elements.snapshotItem(0).click();
                            return true;
                        }
                        
                        return false;
                    }
                """)
                    
                if download_click_success:
                    # Se clicou com sucesso, aguardar o download
                    try:
                        async with page.expect_download(timeout=30000) as download_info:
                            download = await download_info.value
                            await download.save_as(destino)
                            print(f"[DOWNLOAD] Certidão salva em: {destino}")
                            return True, "CND emitida com sucesso.", destino, url_relativo
                    except Exception as e:
                        print(f"[AVISO] Erro ao aguardar download: {e}")
                        # Continua para tentar métodos alternativos
                
                # Fallback: Tentar capturar de nova página/iframe (como estava no original)
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
                        resp = await candidate_page.request.get(url_now)
                        if resp.ok:
                            content = await resp.body()
                            os.makedirs(os.path.dirname(destino), exist_ok=True)
                            with open(destino, "wb") as f:
                                f.write(content)
                            return True, "CND emitida com sucesso (inline).", destino, url_relativo
                    except Exception:
                        pass

                # Tentar iframe/embed
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
                            return True, "CND emitida com sucesso (iframe).", destino, url_relativo
                except Exception:
                    pass

                return False, "Botão/link de PDF não identificado (nem inline/nova aba).", None, None
                
            finally:
                await context.close()
                await browser.close()
                
    except NotImplementedError:
        return (
            False,
            "Automação indisponível neste sistema (Playwright não suportado). Utilize o fallback manual.",
            None,
            None,
        )
    except Exception as exc:
        return False, f"Falha inesperada na automação: {exc}", None, None
