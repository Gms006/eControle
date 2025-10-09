from __future__ import annotations

from pathlib import Path
from typing import Dict, List

from repo_excel import ExcelRepo

PLANILHA_CERT_PATH = r"G:/PMA/CERTIFICADOS.xlsm"


def _get_repo() -> ExcelRepo:
    config_path = Path(__file__).resolve().parent.parent / "config.yaml"
    return ExcelRepo(PLANILHA_CERT_PATH, config_path=str(config_path), data_only=True)


def get_certificados() -> List[Dict]:
    repo = _get_repo()
    repo.open()
    try:
        cfg = repo.config
        sheet = cfg["sheet_names"].get("certificados", "Certificados")
        table = (
            cfg["table_names"].get("certificados", {}).get("certificados", "Certificados")
        )
        rows = repo.read_table(sheet, table, sheet_key="certificados")
        out: List[Dict] = []
        for i, r in enumerate(rows):
            out.append(
                {
                    "id": str(i),
                    "titular": r.get("CERTIFICADO", "") or r.get("CERTIFICADO_TIPO", ""),
                    "validoDe": r.get("VALIDO_DE", ""),
                    "validoAte": r.get("VALIDO_ATE", ""),
                    "senha": r.get("SENHA", ""),
                    "situacao": r.get("SITUACAO", ""),
                }
            )
        return out
    finally:
        repo.close()


def get_agendamentos() -> List[Dict]:
    repo = _get_repo()
    repo.open()
    try:
        cfg = repo.config
        sheet = cfg["sheet_names"].get("certificados_agendamentos", "Agendamentos")
        table = (
            cfg["table_names"]
            .get("certificados_agendamentos", {})
            .get("agendamentos", "Agendamentos")
        )
        rows = repo.read_table(sheet, table, sheet_key="certificados_agendamentos")
        out: List[Dict] = []
        for i, r in enumerate(rows):
            out.append(
                {
                    "id": str(i),
                    "cliente": r.get("CLIENTE", ""),
                    "cpfCnpj": r.get("CPF_CNPJ", ""),
                    "certificadoTipo": r.get("CERTIFICADO_TIPO", ""),
                    "data": r.get("DATA", ""),
                    "metodo": r.get("MEIO", ""),
                    "horario": r.get("HORA", ""),
                    "metodoPagamento": r.get("METODO_PAGAMENTO", ""),
                }
            )
        return out
    finally:
        repo.close()
