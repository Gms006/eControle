import os
import re
from datetime import datetime
from typing import Optional, Tuple

from playwright.async_api import async_playwright

MODO_HEADLESS = os.getenv("CND_HEADLESS", "false").lower() == "true"
EXECUTABLE_PATH = os.getenv("CND_CHROME_PATH")
SAIDA_BASE = os.getenv("CND_DIR_BASE", "certidoes")


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


async def emitir_cnd_anapolis(cnpj: str) -> Tuple[bool, str, Optional[str]]:
    cnpj = only_digits(cnpj)
    os.makedirs(SAIDA_BASE, exist_ok=True)
    destino_dir = os.path.join(SAIDA_BASE, cnpj)
    os.makedirs(destino_dir, exist_ok=True)
    destino = os.path.join(destino_dir, _nome_arquivo_destino())

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=MODO_HEADLESS, executable_path=EXECUTABLE_PATH
        )
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

