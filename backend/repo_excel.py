"""
repo_excel.py - Repositório Excel com leitura/escrita segura e heurística de cabeçalho
Ajustes aplicados:
- Lock de arquivo com portalocker (evita gravação concorrente)
- Métodos públicos build_column_map / get_column_map para /api/diagnostico
- Uso de sheet_key para aliases (config.yaml)
"""
from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Dict, List, Optional, Any

import openpyxl
from openpyxl import load_workbook
from openpyxl.worksheet.worksheet import Worksheet
import yaml
import portalocker

logger = logging.getLogger(__name__)


class ExcelRepo:
    """Repositório para leitura/escrita segura em Excel com macros"""

    def __init__(self, excel_path: str, config_path: str = "config.yaml"):
        self.excel_path = Path(excel_path)
        self.config = self._load_config(config_path)
        self.wb: Optional[openpyxl.Workbook] = None
        self._column_maps: Dict[str, Dict[str, int]] = {}
        self._lock: Optional[portalocker.Lock] = None

    # ---------------------------------------------------------------------
    # Config
    # ---------------------------------------------------------------------
    def _load_config(self, config_path: str) -> dict:
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        except FileNotFoundError:
            logger.warning("Config não encontrado: %s, usando padrões", config_path)
            return {"sheet_names": {}, "column_aliases": {}}

    # ---------------------------------------------------------------------
    # Header detection & mapping
    # ---------------------------------------------------------------------
    def _find_header_row(self, ws: Worksheet, max_rows: int = 10) -> int:
        """Heurística: primeira linha com >=4 valores e contendo keywords."""
        keywords = {"ID", "EMPRESA", "CNPJ", "PROTOCOLO", "TIPO", "STATUS"}
        for row_idx in range(1, min(max_rows + 1, ws.max_row + 1)):
            row_values = [cell.value for cell in ws[row_idx]]
            non_null = [v for v in row_values if v is not None]
            if len(non_null) >= 4:
                row_upper = [str(v).upper().strip() for v in non_null]
                if any(kw in " ".join(row_upper) for kw in keywords):
                    logger.info("Cabeçalho encontrado na linha %s", row_idx)
                    return row_idx
        logger.warning("Cabeçalho não encontrado, usando linha 2 como padrão")
        return 2

    def _build_column_map(self, ws: Worksheet, sheet_key: str) -> Dict[str, int]:
        header_row_idx = self._find_header_row(ws)
        header_row = ws[header_row_idx]
        aliases = self.config.get("column_aliases", {}).get(sheet_key, {})
        col_map: Dict[str, int] = {}
        for col_idx, cell in enumerate(header_row, start=1):
            if cell.value is None:
                continue
            cell_value = str(cell.value).strip()
            # match direto ou por alias
            for canonical, alias_list in aliases.items():
                if any(cell_value.upper() == a.upper() for a in alias_list):
                    col_map[canonical] = col_idx
                    logger.debug("Mapeado: %s -> col %s (%s)", canonical, col_idx, cell_value)
                    break
        if not col_map:
            logger.warning("Nenhuma coluna mapeada para %s", sheet_key)
        return col_map

    # Público (para /api/diagnostico)
    def build_column_map(self, sheet_name: str, sheet_key: str) -> Dict[str, int]:
        if not self.wb:
            raise RuntimeError("Workbook não está aberto")
        ws = self.wb[sheet_name]
        col_map = self._build_column_map(ws, sheet_key)
        self._column_maps[sheet_key] = col_map
        return col_map

    def get_column_map(self, sheet_key: str) -> Dict[str, int]:
        return self._column_maps.get(sheet_key, {})

    # ---------------------------------------------------------------------
    # Open / Save / Close com lock
    # ---------------------------------------------------------------------
    def open(self, lock_timeout: int = 5):
        retry_count = 0
        max_retries = 3
        while retry_count < max_retries:
            try:
                # Lock (modo leitura/escrita)
                self._lock = portalocker.Lock(str(self.excel_path), "r+", timeout=lock_timeout)
                self._lock.acquire()
                # Open workbook preservando macros
                self.wb = load_workbook(self.excel_path, keep_vba=True, data_only=False)
                logger.info("Excel aberto: %s", self.excel_path)
                return
            except (PermissionError, portalocker.exceptions.LockException):
                retry_count += 1
                if retry_count >= max_retries:
                    raise RuntimeError(
                        f"Arquivo bloqueado após {max_retries} tentativas. Feche o Excel e tente novamente."
                    )
                logger.warning("Arquivo bloqueado, tentando novamente (%s/%s)", retry_count, max_retries)
                time.sleep(lock_timeout)

    def save(self):
        if not self.wb:
            raise RuntimeError("Workbook não está aberto")
        try:
            self.wb.save(self.excel_path)
            logger.info("Excel salvo com sucesso")
        except PermissionError:
            raise RuntimeError(
                "Não foi possível salvar: arquivo está aberto em outro programa. Feche o Excel e tente novamente."
            )

    def close(self):
        if self.wb:
            self.wb.close()
            self.wb = None
            self._column_maps.clear()
        if self._lock:
            try:
                self._lock.release()
            finally:
                self._lock = None

    # ---------------------------------------------------------------------
    # Read / Write
    # ---------------------------------------------------------------------
    def read_sheet(self, sheet_name: str, sheet_key: str = "") -> List[Dict[str, Any]]:
        if not self.wb:
            raise RuntimeError("Workbook não está aberto")
        if sheet_name not in self.wb.sheetnames:
            logger.error("Planilha '%s' não encontrada", sheet_name)
            return []
        ws = self.wb[sheet_name]
        # mapa de colunas
        if sheet_key not in self._column_maps:
            self._column_maps[sheet_key] = self._build_column_map(ws, sheet_key)
        col_map = self._column_maps[sheet_key]
        if not col_map:
            logger.warning("Mapa de colunas vazio para %s", sheet_key)
            return []
        # dados
        header_row_idx = self._find_header_row(ws)
        data: List[Dict[str, Any]] = []
        for row_idx in range(header_row_idx + 1, ws.max_row + 1):
            row_data: Dict[str, Any] = {}
            is_empty = True
            for canonical, col_idx in col_map.items():
                value = ws.cell(row_idx, col_idx).value
                if value is not None:
                    is_empty = False
                row_data[canonical] = value if value is not None else ""
            if not is_empty:
                data.append(row_data)
        logger.info("Lidos %s registros de %s", len(data), sheet_name)
        return data

    def write_row(self, sheet_name: str, sheet_key: str, row_data: Dict[str, Any], row_idx: Optional[int] = None):
        if not self.wb:
            raise RuntimeError("Workbook não está aberto")
        ws = self.wb[sheet_name]
        if sheet_key not in self._column_maps:
            self._column_maps[sheet_key] = self._build_column_map(ws, sheet_key)
        col_map = self._column_maps[sheet_key]
        if row_idx is None:
            self._find_header_row(ws)  # garante header calculado
            row_idx = ws.max_row + 1
        for canonical, value in row_data.items():
            if canonical in col_map:
                col_idx = col_map[canonical]
                ws.cell(row_idx, col_idx, value)
        logger.info("Linha %s escrita em %s", row_idx, sheet_name)

    def update_cell(self, sheet_name: str, sheet_key: str, row_idx: int, column_name: str, value: Any):
        if not self.wb:
            raise RuntimeError("Workbook não está aberto")
        ws = self.wb[sheet_name]
        if sheet_key not in self._column_maps:
            self._column_maps[sheet_key] = self._build_column_map(ws, sheet_key)
        col_map = self._column_maps[sheet_key]
        if column_name not in col_map:
            raise ValueError(f"Coluna '{column_name}' não encontrada no mapa")
        col_idx = col_map[column_name]
        ws.cell(row_idx, col_idx, value)
        logger.debug("Célula atualizada: %s[%s,%s] = %s", sheet_name, row_idx, col_idx, value)


# Utilitário CLI
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    repo = ExcelRepo("G:/PMA/LISTA EMPRESAS - NETO CONTABILIDADE 2025.xlsm")
    repo.open()
    try:
        for key, name in {
            "empresas": "EMPRESAS",
            "licencas": "LICENÇAS",
            "taxas": "TAXAS",
        }.items():
            print("\n===", name, "===")
            repo.build_column_map(name, key)
            print(repo.get_column_map(key))
    finally:
        repo.close()