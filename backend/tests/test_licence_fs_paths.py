from pathlib import Path

from app.services.licence_fs_paths import detect_structured_layout, infer_unit_by_cnpj, resolve_target_dir


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


def test_infer_unit_fallbacks_to_matriz():
    assert infer_unit_by_cnpj(None) == "Matriz"
    assert infer_unit_by_cnpj("123") == "Matriz"
