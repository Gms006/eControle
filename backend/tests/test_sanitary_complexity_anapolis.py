from __future__ import annotations

from app.services import sanitary_complexity_anapolis as service


def test_extract_mapping_from_text_tracks_current_complexity_and_cnaes():
    sample = """
    ANEXO UNICO
    COMPLEXIDADE I
    47.11-3-02 Comercio varejista.
    47.21-1-03 Hortifruti.
    COMPLEXIDADE III
    56.11-2-01 Restaurantes.
    """
    mapping = service._extract_mapping_from_text(sample)
    assert mapping["47.11-3-02"] == "BAIXA"
    assert mapping["4711302"] == "BAIXA"
    assert mapping["47113"] == "BAIXA"
    assert mapping["47.21-1-03"] == "BAIXA"
    assert mapping["56.11-2-01"] == "ALTA"


def test_extract_mapping_keeps_highest_complexity_for_same_cnae():
    sample = """
    COMPLEXIDADE I
    47.11-3-02 Comercio varejista.
    COMPLEXIDADE III
    47.11-3-02 Comercio varejista em outra regra.
    """
    mapping = service._extract_mapping_from_text(sample)
    assert mapping["47.11-3-02"] == "ALTA"


def test_infer_sanitary_complexity_from_cnaes_uses_highest_subject_code(monkeypatch):
    monkeypatch.setattr(
        service,
        "_load_annex_mapping",
        lambda: {
            "47.11-3-02": "BAIXA",
            "56.11-2-01": "ALTA",
        },
    )

    inferred = service.infer_sanitary_complexity_from_cnaes(
        [{"code": "47.11-3-02", "text": "Comercio"}],
        [{"code": "56.11-2-01", "text": "Restaurantes"}],
    )

    assert inferred == "ALTA"


def test_infer_sanitary_complexity_returns_not_applicable_when_no_subject_code(monkeypatch):
    monkeypatch.setattr(
        service,
        "_load_annex_mapping",
        lambda: {
            "56.11-2-01": "ALTA",
        },
    )

    inferred = service.infer_sanitary_complexity_from_cnaes(
        [{"code": "47.11-3-02", "text": "Comercio"}],
        [{"code": "47.21-1-03", "text": "Hortifruti"}],
    )

    assert inferred == "NAO_APLICAVEL"


def test_infer_sanitary_complexity_matches_by_digits_variant(monkeypatch):
    monkeypatch.setattr(
        service,
        "_load_annex_mapping",
        lambda: {
            "4711302": "ALTA",
        },
    )

    inferred = service.infer_sanitary_complexity_from_cnaes(
        [{"code": "47.11-3/02", "text": "Supermercados"}],
    )

    assert inferred == "ALTA"


def test_infer_sanitary_complexity_returns_none_when_annex_mapping_unavailable(monkeypatch):
    def _boom():
        raise RuntimeError("mapping empty")

    monkeypatch.setattr(service, "_load_annex_mapping", _boom)
    inferred = service.infer_sanitary_complexity_from_cnaes(
        [{"code": "47.11-3-02", "text": "Comercio"}],
    )
    assert inferred is None


def test_infer_sanitary_complexity_falls_back_to_5_digit_class(monkeypatch):
    monkeypatch.setattr(
        service,
        "_load_annex_mapping",
        lambda: {
            "47113": "MEDIA",
        },
    )

    inferred = service.infer_sanitary_complexity_from_cnaes(
        [{"code": "47.11-3", "text": "Comercio varejista"}],
    )

    assert inferred == "MEDIA"
