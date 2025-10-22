"""Worker responsável pela emissão da CND municipal de Goiânia (GO)."""

from __future__ import annotations

import asyncio
import base64
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

import requests
from playwright.async_api import (
    TimeoutError as PlaywrightTimeoutError,
    async_playwright,
)

URL_BASE = "https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00300f0.asp"


def _only_digits(value: str) -> str:
    return re.sub(r"\D+", "", value or "")


def _build_filename() -> str:
    today = datetime.now().strftime("%d.%m.%Y")
    return f"CND - Goiania - {today}.pdf"


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


async def _fill_nearby_captcha_input(page, text: str) -> bool:
    # Primeiro tenta seletores comuns
    selectors: Iterable[str] = (
        'input[name="captcha"]',
        'input[name="txt_captcha"]',
        'input[name*="captcha" i]',
        'input[id*="captcha" i]',
    )
    for selector in selectors:
        locator = page.locator(selector).first
        if await locator.count():
            try:
                await locator.fill(text)
                await locator.dispatch_event("input")
                await locator.dispatch_event("change")
                return True
            except Exception:
                continue

    # Fallback: procurar campo próximo da imagem do captcha
    script = """
        (value) => {
            const img = document.querySelector('img[src*="captcha"]');
            if (!img) {
                return false;
            }

            const candidates = Array.from(
                document.querySelectorAll('input:not([type]), input[type="text"], input[type="tel"], input[type="search"], input[type="number"]')
            ).filter((el) => !el.disabled && !el.readOnly);

            if (!candidates.length) {
                return false;
            }

            const imgRect = img.getBoundingClientRect();
            let best = null;
            let bestScore = Infinity;

            for (const input of candidates) {
                const rect = input.getBoundingClientRect();
                const dx = Math.abs((rect.left + rect.right) / 2 - (imgRect.left + imgRect.right) / 2);
                const dy = Math.abs((rect.top + rect.bottom) / 2 - (imgRect.top + imgRect.bottom) / 2);
                const score = Math.hypot(dx, dy);
                if (score < bestScore) {
                    bestScore = score;
                    best = input;
                }
            }

            const target = best || candidates[0];
            if (!target) {
                return false;
            }

            target.focus();
            target.value = value;
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
    """

    try:
        return bool(await page.evaluate(script, text))
    except Exception:
        return False


def _solve_captcha_via_2captcha(image_b64: str, api_key: str, timeout: int = 120) -> str:
    if not api_key:
        raise RuntimeError("Chave 2Captcha não configurada (CND_2CAPTCHA_KEY).")

    start = time.time()
    response = requests.post(
        "http://2captcha.com/in.php",
        data={"method": "base64", "key": api_key, "body": image_b64, "json": 1},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("status") != 1:
        raise RuntimeError(f"Falha ao enviar captcha ao 2Captcha: {payload}")

    captcha_id = payload["request"]
    while time.time() - start < timeout:
        time.sleep(5)
        result = requests.get(
            "http://2captcha.com/res.php",
            params={"key": api_key, "action": "get", "id": captcha_id, "json": 1},
            timeout=30,
        )
        result.raise_for_status()
        data = result.json()
        if data.get("status") == 1:
            return data["request"]
        if data.get("request") not in {"CAPCHA_NOT_READY", "CAPTCHA_NOT_READY"}:
            raise RuntimeError(f"2Captcha retornou erro: {data}")

    raise TimeoutError("Timeout aguardando resposta do 2Captcha.")


async def _handle_captcha_if_needed(page, *, mode: str, api_key: str) -> None:
    captcha_image = page.locator('img[src*="captcha"]').first
    if not await captcha_image.count():
        return

    solved = False
    if mode in {"2captcha", "image_2captcha"}:
        if not api_key:
            print("[GOIÂNIA] Chave 2Captcha ausente (CND_2CAPTCHA_KEY).")
        else:
            try:
                png_bytes = await captcha_image.screenshot(type="png")
                answer = _solve_captcha_via_2captcha(
                    base64.b64encode(png_bytes).decode(),
                    api_key,
                )
                solved = await _fill_nearby_captcha_input(page, answer)
                if solved:
                    print("[GOIÂNIA] Captcha preenchido automaticamente via 2Captcha.")
            except Exception as exc:
                print(f"[GOIÂNIA] Falha ao resolver captcha via 2Captcha: {exc}")

    if not solved:
        # Modo manual ou fallback quando automático falha
        print("[GOIÂNIA] Resolver captcha manualmente e prosseguir (se aplicável).")
        try:
            await page.bring_to_front()
        except Exception:
            pass


async def _emitir_cnd_goiania_impl(
    *,
    cnpj_digits: str,
    filename: str,
    out_path: Path,
    headless: bool,
    chrome_path: Optional[str],
    timeout_ms: int,
    require_captcha: bool,
    captcha_mode: str,
    captcha_api_key: str,
) -> dict:
    try:
        async with async_playwright() as playwright:
            effective_headless = headless
            if not effective_headless:
                print(
                    "[GOIÂNIA] Forçando execução em modo headless para permitir exportação em PDF."
                )
                effective_headless = True

            launch_args = {
                "headless": effective_headless,
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

            browser = None
            context = None
            try:
                browser = await playwright.chromium.launch(**launch_args)
                context = await browser.new_context(
                    locale="pt-BR",
                    viewport={"width": 1280, "height": 900},
                )
                page = await context.new_page()

                await page.goto(URL_BASE, wait_until="domcontentloaded", timeout=timeout_ms)

                await page.wait_for_selector('select[name="sel_cpfcnpj"]', timeout=timeout_ms)
                await page.select_option('select[name="sel_cpfcnpj"]', value="2")

                cnpj_input = page.locator('input[name="txt_nr_cpfcnpj"]').first
                await cnpj_input.wait_for(state="visible", timeout=timeout_ms)
                await cnpj_input.fill(cnpj_digits)

                if require_captcha:
                    await _handle_captcha_if_needed(
                        page,
                        mode=captcha_mode,
                        api_key=captcha_api_key,
                    )

                submit_selector = 'input[type="submit"][value="Emitir Certidão"]'
                await page.wait_for_selector(submit_selector, timeout=timeout_ms)
                await page.click(submit_selector)

                wait_url = asyncio.create_task(
                    page.wait_for_url(
                        re.compile(r"sccer00300w0\\.asp", re.IGNORECASE),
                        timeout=timeout_ms,
                    )
                )
                wait_icon = asyncio.create_task(
                    page.wait_for_selector(
                        'img[src*="/sistemas/saces/imagem/impr.gif"]',
                        timeout=timeout_ms,
                    )
                )
                wait_text = asyncio.create_task(
                    page.wait_for_selector(
                        "text=PREFEITURA MUNICIPAL DE GOIÂNIA",
                        timeout=timeout_ms,
                    )
                )

                done, pending = await asyncio.wait(
                    {wait_url, wait_icon, wait_text},
                    return_when=asyncio.FIRST_COMPLETED,
                )

                success = False
                for task in done:
                    try:
                        await task
                        success = True
                    except PlaywrightTimeoutError:
                        pass
                    except Exception as exc:
                        print(f"[GOIÂNIA] Erro aguardando certidão: {exc}")

                for task in pending:
                    task.cancel()
                await asyncio.gather(*pending, return_exceptions=True)

                if not success:
                    return {
                        "ok": False,
                        "info": "Não foi possível confirmar a emissão da certidão (timeout).",
                        "path": None,
                        "url": None,
                    }

                await page.wait_for_timeout(1000)
                await page.emulate_media(media="print")
                await page.pdf(
                    path=str(out_path),
                    format="A4",
                    print_background=True,
                )

                return {
                    "ok": True,
                    "info": "CND (Goiânia) gerada com sucesso",
                    "path": str(out_path),
                    "url": f"/cnds/{cnpj_digits}/{filename}",
                }

            finally:
                if context is not None:
                    await context.close()
                if browser is not None:
                    await browser.close()

    except PlaywrightTimeoutError:
        return {
            "ok": False,
            "info": "Tempo esgotado ao tentar acessar o portal de Goiânia.",
            "path": None,
            "url": None,
        }
    except Exception as exc:
        return {
            "ok": False,
            "info": f"Falha inesperada na emissão da CND de Goiânia: {exc}",
            "path": None,
            "url": None,
        }


async def _run_in_proactor_thread(**kwargs) -> dict:
    def runner() -> dict:
        loop = None
        try:
            if sys.platform.startswith("win"):
                policy_cls = getattr(asyncio, "WindowsProactorEventLoopPolicy", None)
                if policy_cls is not None:
                    asyncio.set_event_loop_policy(policy_cls())
                try:
                    from asyncio import windows_events  # type: ignore

                    loop = windows_events.ProactorEventLoop()
                except Exception:
                    loop = asyncio.new_event_loop()
            else:
                loop = asyncio.new_event_loop()

            asyncio.set_event_loop(loop)
            return loop.run_until_complete(_emitir_cnd_goiania_impl(**kwargs))
        finally:
            try:
                if loop is not None and not loop.is_closed():
                    try:
                        loop.run_until_complete(loop.shutdown_asyncgens())
                    except Exception:
                        pass
                    loop.close()
            finally:
                asyncio.set_event_loop(None)

    if hasattr(asyncio, "to_thread"):
        return await asyncio.to_thread(runner)

    running_loop = asyncio.get_running_loop()
    return await running_loop.run_in_executor(None, runner)


async def emitir_cnd_goiania(
    cnpj: str,
    *,
    download_dir: Path,
    headless: bool = True,
    chrome_path: Optional[str] = None,
    timeout_ms: int = 60000,
) -> dict:
    """Emite a CND municipal de Goiânia."""

    cnpj_digits = _only_digits(cnpj)
    if len(cnpj_digits) != 14:
        raise ValueError("CNPJ inválido (14 dígitos).")

    base_dir = Path(download_dir)
    target_dir = base_dir / cnpj_digits
    _ensure_dir(target_dir)

    filename = _build_filename()
    out_path = target_dir / filename

    require_captcha = _env_flag("CND_GOIANIA_REQUIRE_CAPTCHA", False)
    captcha_mode = (os.getenv("CND_CAPTCHA_MODE") or "manual").strip().lower()
    captcha_api_key = os.getenv("CND_2CAPTCHA_KEY", "").strip()

    return await _run_in_proactor_thread(
        cnpj_digits=cnpj_digits,
        filename=filename,
        out_path=out_path,
        headless=headless,
        chrome_path=chrome_path,
        timeout_ms=timeout_ms,
        require_captcha=require_captcha,
        captcha_mode=captcha_mode,
        captcha_api_key=captcha_api_key,
    )
