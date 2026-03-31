import pytest

from app.core.normalize import (
    GENERIC_STATUS_ACCEPT_MAP,
    PROCESS_SITUACAO_ACCEPT_MAP,
    normalize_date_br,
    normalize_generic_status,
    normalize_municipio,
    normalize_status,
    normalize_title_case,
)


def test_normalize_municipio_go_aliases():
    assert normalize_municipio("anapolis") == "anapolis"
    assert normalize_municipio("GOIANIA") == "goiania"
    assert normalize_municipio("aparecida de goiania") == "aparecida de goiania"


def test_normalize_title_case_preserves_corporate_suffixes():
    assert normalize_title_case("wvm energia e eventos ltda") == "Wvm Energia e Eventos LTDA"
    assert normalize_title_case("valdivino pereira da silva o goiano") == "Valdivino Pereira da Silva O Goiano"


def test_normalize_status_accepts_legacy_and_returns_canonical():
    assert normalize_status("EM ANÁLISE", PROCESS_SITUACAO_ACCEPT_MAP) == "em_analise"
    assert normalize_status("concluído", PROCESS_SITUACAO_ACCEPT_MAP) == "concluido"
    assert normalize_status("Em aberto", GENERIC_STATUS_ACCEPT_MAP) == "em_aberto"


def test_normalize_generic_status_falls_back_to_snake_case():
    assert normalize_generic_status("EM ANÁLISE", strict=False) == "em_analise"


def test_normalize_date_br_to_iso():
    assert normalize_date_br("27/02/2026") == "2026-02-27"
    assert normalize_date_br("2026-02-27") == "2026-02-27"


def test_normalize_status_rejects_unknown_when_strict():
    with pytest.raises(ValueError):
        normalize_status("status_inexistente", PROCESS_SITUACAO_ACCEPT_MAP, strict=True)
