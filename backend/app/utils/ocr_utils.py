"""Utilitários simples para extração de dados de CNDs."""

from __future__ import annotations

import logging
import re
from datetime import date
from pathlib import Path
from typing import Dict

logger = logging.getLogger(__name__)

CNPJ_PATTERN = re.compile(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}")
DATE_PATTERN = re.compile(r"(\d{2})[/-](\d{2})[/-](\d{4})")


def _normalize_date(raw: str | None) -> date | None:
    if not raw:
        return None
    match = DATE_PATTERN.search(raw)
    if not match:
        return None
    day, month, year = match.groups()
    try:
        return date(int(year), int(month), int(day))
    except ValueError:
        logger.debug("Data inválida ignorada durante parsing de CND: %s", raw)
        return None


def _parse_common_fields(text: str) -> Dict[str, str | date | None]:
    cnpj_match = CNPJ_PATTERN.search(text)
    validade = _normalize_date(text)
    return {
        "cnpj": cnpj_match.group(0) if cnpj_match else None,
        "orgao": None,
        "esfera": None,
        "validade": validade,
        "status": None,
    }


def parse_pdf(file_path: str) -> Dict[str, str | date | None]:
    """Parser simplificado para CNDs em PDF.

    A estratégia padrão lê o arquivo como texto bruto. Dependendo da estrutura do
    PDF, o conteúdo extraído pode ser limitado; ainda assim, o resultado padroniza
    as chaves esperadas para armazenamento posterior.
    """

    text = Path(file_path).read_bytes().decode("latin-1", errors="ignore")
    return _parse_common_fields(text)


def parse_html(file_path: str) -> Dict[str, str | date | None]:
    """Parser simplificado para CNDs em HTML, removendo tags básicas."""

    raw = Path(file_path).read_text(encoding="utf-8", errors="ignore")
    text = re.sub(r"<[^>]+>", " ", raw)
    return _parse_common_fields(text)


def ocr_parse_image(file_path: str) -> Dict[str, str | date | None]:
    """Parser de imagem baseado em nome do arquivo para ambientes sem OCR.

    Sem dependências adicionais de OCR, este utilitário tenta extrair informações
    mínimas do nome do arquivo. Recomenda-se substituir por uma implementação mais
    robusta quando uma solução de OCR estiver disponível.
    """

    name = Path(file_path).stem
    return _parse_common_fields(name)
