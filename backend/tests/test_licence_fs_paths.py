from pathlib import Path

import pytest

from app.services.licence_fs_paths import (
    _extract_municipio_name,
    detect_structured_layout,
    infer_unit_by_cnpj,
    resolve_target_dir,
)


# ---------------------------------------------------------------------------
# _extract_municipio_name
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "raw, expected",
    [
        ("Anápolis/GO", "Anápolis"),
        ("Anápolis/go", "Anápolis"),
        ("Valparaíso de Goiás/GO", "Valparaíso de Goiás"),
        ("Anápolis - GO", "Anápolis"),
        ("Anápolis - Go", "Anápolis"),
        ("Rio Branco/AC", "Rio Branco"),
        ("Anápolis", "Anápolis"),          # no suffix → unchanged
        ("", ""),
        (None, ""),
    ],
)
def test_extract_municipio_name(raw, expected):
    assert _extract_municipio_name(raw) == expected


# ---------------------------------------------------------------------------
# infer_unit_by_cnpj
# ---------------------------------------------------------------------------

def test_infer_unit_fallbacks_to_matriz():
    assert infer_unit_by_cnpj(None) == "Matriz"
    assert infer_unit_by_cnpj("123") == "Matriz"


# ---------------------------------------------------------------------------
# resolve_target_dir — existing cases (must keep passing)
# ---------------------------------------------------------------------------

def test_resolve_prefers_municipio_dash_unit(tmp_path):
    base = Path(tmp_path) / "Societário" / "Alvarás e Certidões"
    (base / "Anápolis - Matriz").mkdir(parents=True, exist_ok=True)
    (base / "Matriz").mkdir(parents=True, exist_ok=True)

    result = resolve_target_dir(base, municipio="Anápolis", cnpj="12.345.678/0001-10")
    assert result.structured_layout is True
    assert result.unit == "Matriz"
    assert result.target_dir is not None
    assert result.target_dir.name == "Anápolis - Matriz"


def test_resolve_uses_simple_unit_folder(tmp_path):
    base = Path(tmp_path) / "Societário" / "Alvarás e Certidões"
    (base / "Filial").mkdir(parents=True, exist_ok=True)

    result = resolve_target_dir(base, municipio="Goiânia", cnpj="12.345.678/0002-10")
    assert result.structured_layout is True
    assert result.unit == "Filial"
    assert result.target_dir is not None
    assert result.target_dir.name == "Filial"


def test_resolve_detects_missing_subdir_when_structured(tmp_path):
    base = Path(tmp_path) / "Societário" / "Alvarás e Certidões"
    (base / "Anápolis - Matriz").mkdir(parents=True, exist_ok=True)

    result = resolve_target_dir(base, municipio="Goiânia", cnpj="12.345.678/0002-10")
    assert detect_structured_layout(base) is True
    assert result.structured_layout is True
    assert result.target_dir is None
    assert "Structured layout detected" in (result.warning or "")


def test_resolve_falls_back_to_single_unit_folder_when_municipio_differs(tmp_path):
    base = Path(tmp_path) / "Societário" / "Alvarás e Certidões"
    (base / "Valparaíso de Goiás - Matriz").mkdir(parents=True, exist_ok=True)
    (base / "Anápolis - Filial").mkdir(parents=True, exist_ok=True)

    result = resolve_target_dir(base, municipio="Valparaíso de Goiás/GO", cnpj="12.345.678/0001-10")
    assert result.structured_layout is True
    assert result.unit == "Matriz"
    assert result.target_dir is not None
    assert result.target_dir.name == "Valparaíso de Goiás - Matriz"


def test_resolve_falls_back_to_any_filial_when_multiple_and_municipio_not_found(tmp_path):
    base = Path(tmp_path) / "Societário" / "Alvarás e Certidões"
    (base / "Anápolis - Filial").mkdir(parents=True, exist_ok=True)
    (base / "Rialma - Filial").mkdir(parents=True, exist_ok=True)

    result = resolve_target_dir(base, municipio="Município inexistente", cnpj="12.345.678/0002-10")
    assert result.structured_layout is True
    assert result.unit == "Filial"
    assert result.target_dir is not None
    assert "Filial" in result.target_dir.name


def test_resolve_falls_back_to_any_structured_dir_when_unit_not_found(tmp_path):
    base = Path(tmp_path) / "Societário" / "Alvarás e Certidões"
    (base / "Anápolis - Filial").mkdir(parents=True, exist_ok=True)
    (base / "Rialma - Filial (Inativa)").mkdir(parents=True, exist_ok=True)

    result = resolve_target_dir(base, municipio="Anápolis", cnpj="12.345.678/0001-10")
    assert result.structured_layout is True
    assert result.target_dir is not None
    assert result.target_dir.name == "Anápolis - Filial"


# ---------------------------------------------------------------------------
# resolve_target_dir — NEW: municipio with UF suffix (the bug being fixed)
# ---------------------------------------------------------------------------

def test_resolve_with_uf_suffix_slash(tmp_path):
    """'Anápolis/GO' stored in DB must match folder 'Anápolis - Filial'."""
    base = Path(tmp_path) / "Societário" / "Alvarás e Certidões"
    (base / "Anápolis - Filial").mkdir(parents=True, exist_ok=True)
    (base / "Rio Branco - Filial (Inativa)").mkdir(parents=True, exist_ok=True)
    (base / "Valparaíso de Goiás - Matriz").mkdir(parents=True, exist_ok=True)

    result = resolve_target_dir(base, municipio="Anápolis/GO", cnpj="12.345.678/0002-10")
    assert result.structured_layout is True
    assert result.unit == "Filial"
    assert result.target_dir is not None
    assert result.target_dir.name == "Anápolis - Filial"


def test_resolve_with_uf_suffix_dash(tmp_path):
    """'Anápolis - GO' stored in DB must match folder 'Anápolis - Filial'."""
    base = Path(tmp_path) / "Societário" / "Alvarás e Certidões"
    (base / "Anápolis - Filial").mkdir(parents=True, exist_ok=True)
    (base / "Rio Branco - Filial (Inativa)").mkdir(parents=True, exist_ok=True)
    (base / "Valparaíso de Goiás - Matriz").mkdir(parents=True, exist_ok=True)

    result = resolve_target_dir(base, municipio="Anápolis - GO", cnpj="12.345.678/0002-10")
    assert result.structured_layout is True
    assert result.unit == "Filial"
    assert result.target_dir is not None
    assert result.target_dir.name == "Anápolis - Filial"


def test_resolve_matriz_with_uf_suffix(tmp_path):
    """'Valparaíso de Goiás/GO' must match folder 'Valparaíso de Goiás - Matriz'."""
    base = Path(tmp_path) / "Societário" / "Alvarás e Certidões"
    (base / "Anápolis - Filial").mkdir(parents=True, exist_ok=True)
    (base / "Rio Branco - Filial (Inativa)").mkdir(parents=True, exist_ok=True)
    (base / "Valparaíso de Goiás - Matriz").mkdir(parents=True, exist_ok=True)

    result = resolve_target_dir(base, municipio="Valparaíso de Goiás/GO", cnpj="12.345.678/0001-10")
    assert result.structured_layout is True
    assert result.unit == "Matriz"
    assert result.target_dir is not None
    assert result.target_dir.name == "Valparaíso de Goiás - Matriz"


def test_resolve_two_active_filiais_with_uf_suffix(tmp_path):
    """
    GREEN AMBIENTAL-style: two active filiais, municipio has '/GO' suffix.
    Each filial CNPJ must resolve to its own folder — not fall through to
    the heuristic single-active-unit path.
    """
    base = Path(tmp_path) / "Societário" / "Alvarás e Certidões"
    (base / "Anápolis - Filial").mkdir(parents=True, exist_ok=True)
    (base / "Goiânia - Filial").mkdir(parents=True, exist_ok=True)
    (base / "Valparaíso de Goiás - Matriz").mkdir(parents=True, exist_ok=True)

    result_anapolis = resolve_target_dir(base, municipio="Anápolis/GO", cnpj="12.345.678/0002-10")
    assert result_anapolis.target_dir is not None
    assert result_anapolis.target_dir.name == "Anápolis - Filial"

    result_goiania = resolve_target_dir(base, municipio="Goiânia/GO", cnpj="12.345.678/0003-91")
    assert result_goiania.target_dir is not None
    assert result_goiania.target_dir.name == "Goiânia - Filial"


def test_resolve_silveira_canedo_simple_layout(tmp_path):
    """SILVEIRA & CANEDO: plain 'Matriz'/'Filial' folders, same municipio."""
    base = Path(tmp_path) / "Societário" / "Alvarás e Certidões"
    (base / "Matriz").mkdir(parents=True, exist_ok=True)
    (base / "Filial").mkdir(parents=True, exist_ok=True)

    result_matriz = resolve_target_dir(base, municipio="Anápolis/GO", cnpj="12.345.678/0001-10")
    assert result_matriz.target_dir is not None
    assert result_matriz.target_dir.name == "Matriz"

    result_filial = resolve_target_dir(base, municipio="Anápolis/GO", cnpj="12.345.678/0002-91")
    assert result_filial.target_dir is not None
    assert result_filial.target_dir.name == "Filial"