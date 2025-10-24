from __future__ import annotations

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
import sqlalchemy as sa
from sqlalchemy.engine import Engine

from backend.etl.contracts import load_contract
from backend.etl.extract_xlsm import ROW_NUMBER_KEY
from backend.etl.load_upsert import run as run_loader
from backend.etl.transform_normalize import TransformError, transform


@pytest.fixture()
def contract():
    config_path = Path(__file__).resolve().parents[1] / "backend" / "config.yaml"
    return load_contract(config_path)


@pytest.fixture()
def engine(contract) -> Engine:
    engine = sa.create_engine("sqlite+pysqlite:///:memory:", future=True)
    metadata = sa.MetaData()

    sa.Table(
        "empresas",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("empresa", sa.String(255), nullable=False),
        sa.Column("cnpj", sa.String(14), nullable=False, unique=True),
        sa.Column("municipio", sa.String(120), nullable=False),
        sa.Column("porte", sa.String(50)),
        sa.Column("categoria", sa.String(120)),
        sa.Column("ie", sa.String(50)),
        sa.Column("im", sa.String(50)),
        sa.Column("situacao", sa.String(120)),
        sa.Column("debito", sa.String(120)),
        sa.Column("certificado", sa.String(120)),
        sa.Column("obs", sa.Text),
        sa.Column("proprietario", sa.String(255)),
        sa.Column("cpf", sa.String(14)),
        sa.Column("telefone", sa.String(60)),
        sa.Column("email", sa.String(255)),
        sa.Column("responsavel", sa.String(255)),
    )

    sa.Table(
        "licencas",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("empresa_id", sa.Integer, nullable=False),
        sa.Column("tipo", sa.String(50), nullable=False),
        sa.Column("status", sa.String(120), nullable=False),
        sa.Column("obs", sa.Text),
    )

    sa.Table(
        "taxas",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("empresa_id", sa.Integer, nullable=False),
        sa.Column("tipo", sa.String(50), nullable=False),
        sa.Column("status", sa.String(120), nullable=False),
        sa.Column("obs", sa.Text),
    )

    sa.Table(
        "processos",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("empresa_id", sa.Integer, nullable=False),
        sa.Column("tipo", sa.String(50), nullable=False),
        sa.Column("protocolo", sa.String(120)),
        sa.Column("data_solicitacao", sa.Date, nullable=False),
        sa.Column("situacao", sa.String(120), nullable=False),
        sa.Column("status_padrao", sa.String(120)),
        sa.Column("obs", sa.Text),
        sa.Column("operacao", sa.String(120)),
        sa.Column("orgao", sa.String(120)),
        sa.Column("alvara", sa.String(120)),
        sa.Column("municipio", sa.String(120)),
        sa.Column("tpi", sa.String(120)),
        sa.Column("inscricao_imobiliaria", sa.String(120)),
        sa.Column("servico", sa.String(120)),
        sa.Column("taxa", sa.String(120)),
        sa.Column("notificacao", sa.String(120)),
        sa.Column("data_val", sa.Date),
    )

    for name in (
        "stg_empresas",
        "stg_licencas",
        "stg_taxas",
        "stg_processos",
        "stg_certificados",
        "stg_certificados_agendamentos",
    ):
        sa.Table(
            name,
            metadata,
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("run_id", sa.String(36), nullable=False),
            sa.Column("file_source", sa.String(255), nullable=False),
            sa.Column("row_number", sa.Integer, nullable=False),
            sa.Column("row_hash", sa.String(64), nullable=False),
            sa.Column("payload", sa.JSON, nullable=False),
            sa.Column("ingested_at", sa.String(25)),
        )

    metadata.create_all(engine)
    return engine


def sample_raw_data():
    empresas = [
        {
            "EMPRESA": "ACME LTDA",
            "CNPJ": "12.345.678/0001-90",
            "MUNICÍPIO": "Anápolis",
            "PORTE": "ME",
            "CATEGORIA": "Serviços",
            "SITUAÇÃO": "Ativa",
            ROW_NUMBER_KEY: 2,
        }
    ]

    licencas = [
        {
            "EMPRESA": "ACME LTDA",
            "CNPJ": "12.345.678/0001-90",
            "ALVARÁ FUNCIONAMENTO": "Regular",
            "ALVARÁ VIG SANITÁRIA": "Em dia",
            ROW_NUMBER_KEY: 2,
        }
    ]

    taxas = [
        {
            "EMPRESA": "ACME LTDA",
            "CNPJ": "12.345.678/0001-90",
            "TAXA FUNCIONAMENTO": "Aberto",
            ROW_NUMBER_KEY: 2,
        }
    ]

    processos = {
        "diversos": [
            {
                "EMPRESA": "ACME LTDA",
                "CNPJ": "12.345.678/0001-90",
                "PROTOCOLO": "PROC-123",
                "DATA SOLICITAÇÃO": "01/02/2024",
                "SITUAÇÃO": "EM ANÁLISE",
                "OPERAÇÃO": "INSCRIÇÃO",
                "ÓRGÃO": "PREFEITURA",
                ROW_NUMBER_KEY: 2,
            }
        ],
        "sanitario": [
            {
                "EMPRESA": "ACME LTDA",
                "CNPJ": "12.345.678/0001-90",
                "PROTOCOLO": "SAN-55",
                "DATA SOLICITAÇÃO": "05/02/2024",
                "SITUAÇÃO": "AGUARD DOCTO",
                "SERVIÇO": "RENOVAÇÃO",
                "TAXA": "Pago",
                "NOTIFICAÇÃO": "SEM PENDÊNCIAS",
                "DATA VAL": "05/08/2024",
                ROW_NUMBER_KEY: 3,
            }
        ],
    }

    return {
        "empresas": empresas,
        "licencas": licencas,
        "taxas": taxas,
        "processos": processos,
    }


def test_upsert_idempotent(engine, contract):
    raw = sample_raw_data()
    normalized = transform(raw, contract)

    first = run_loader(
        engine,
        normalized,
        run_id="run-1",
        file_source="teste.xlsx",
        dry_run=False,
    )
    assert any(item["action"] == "insert" and item["table"] == "empresas" for item in first)

    second = run_loader(
        engine,
        normalized,
        run_id="run-2",
        file_source="teste.xlsx",
        dry_run=False,
    )
    assert any(item["action"] == "skip" and item["table"] == "empresas" for item in second)

    # Update taxa status to trigger update
    raw["taxas"][0]["TAXA FUNCIONAMENTO"] = "Pago"
    normalized_update = transform(raw, contract)
    third = run_loader(
        engine,
        normalized_update,
        run_id="run-3",
        file_source="teste.xlsx",
        dry_run=False,
    )
    assert any(item["action"] == "update" and item["table"] == "taxas" for item in third)


def test_invalid_enum(contract):
    raw = sample_raw_data()
    raw["processos"]["diversos"][0]["SITUAÇÃO"] = "INVALIDO"
    with pytest.raises(TransformError):
        transform(raw, contract)


def test_invalid_date(contract):
    raw = sample_raw_data()
    raw["processos"]["diversos"][0]["DATA SOLICITAÇÃO"] = "32/13/2024"
    with pytest.raises(TransformError):
        transform(raw, contract)
