from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert


ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.session import SessionLocal  # noqa: E402
from app.models.cnae_risk import CNAERisk  # noqa: E402


SEED_HEADERS = [
    "cnae_code",
    "cnae_text",
    "risk_tier",
    "base_weight",
    "sanitary_risk",
    "fire_risk",
    "environmental_risk",
    "notes",
    "source",
    "is_active",
]


def _as_bool(value: Any) -> bool:
    text = str(value or "").strip().lower()
    return text in {"1", "true", "t", "yes", "y", "sim", "s"}


def _normalize_text(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def _load_rows(seed_file: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with seed_file.open("r", encoding="utf-8", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        if reader.fieldnames != SEED_HEADERS:
            raise ValueError(
                "CSV header invalido para cnae_risks.seed.csv. "
                f"Esperado: {SEED_HEADERS}; recebido: {reader.fieldnames}"
            )
        for row in reader:
            cnae_code = _normalize_text(row.get("cnae_code"))
            cnae_text = _normalize_text(row.get("cnae_text"))
            if not cnae_code or cnae_code == "00.00-0-00" or not cnae_text:
                continue
            rows.append(
                {
                    "cnae_code": cnae_code,
                    "cnae_text": cnae_text,
                    "risk_tier": _normalize_text(row.get("risk_tier")),
                    "base_weight": int(str(row.get("base_weight") or "0").strip() or "0"),
                    "sanitary_risk": _normalize_text(row.get("sanitary_risk")),
                    "fire_risk": _normalize_text(row.get("fire_risk")),
                    "environmental_risk": _normalize_text(row.get("environmental_risk")),
                    "notes": _normalize_text(row.get("notes")),
                    "source": _normalize_text(row.get("source")),
                    "is_active": _as_bool(row.get("is_active")),
                }
            )
    return rows


def load_seed(seed_file: Path) -> tuple[int, int, int]:
    payload_rows = _load_rows(seed_file)
    db = SessionLocal()
    inserted = 0
    updated = 0
    unchanged = 0
    try:
        existing_rows = db.execute(
            select(
                CNAERisk.cnae_code,
                CNAERisk.cnae_text,
                CNAERisk.risk_tier,
                CNAERisk.base_weight,
                CNAERisk.sanitary_risk,
                CNAERisk.fire_risk,
                CNAERisk.environmental_risk,
                CNAERisk.notes,
                CNAERisk.source,
                CNAERisk.is_active,
            )
        ).all()
        existing_by_code = {
            str(item[0]): {
                "cnae_text": item[1],
                "risk_tier": item[2],
                "base_weight": item[3],
                "sanitary_risk": item[4],
                "fire_risk": item[5],
                "environmental_risk": item[6],
                "notes": item[7],
                "source": item[8],
                "is_active": item[9],
            }
            for item in existing_rows
        }

        for row in payload_rows:
            current = existing_by_code.get(row["cnae_code"])
            if not current:
                inserted += 1
            elif current == {k: v for k, v in row.items() if k != "cnae_code"}:
                unchanged += 1
            else:
                updated += 1

        if payload_rows:
            stmt = insert(CNAERisk).values(payload_rows)
            stmt = stmt.on_conflict_do_update(
                index_elements=[CNAERisk.cnae_code],
                set_={
                    "cnae_text": stmt.excluded.cnae_text,
                    "risk_tier": stmt.excluded.risk_tier,
                    "base_weight": stmt.excluded.base_weight,
                    "sanitary_risk": stmt.excluded.sanitary_risk,
                    "fire_risk": stmt.excluded.fire_risk,
                    "environmental_risk": stmt.excluded.environmental_risk,
                    "notes": stmt.excluded.notes,
                    "source": stmt.excluded.source,
                    "is_active": stmt.excluded.is_active,
                },
            )
            db.execute(stmt)
        db.commit()
        return inserted, updated, unchanged
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Carrega seed de cnae_risks com upsert por cnae_code.")
    parser.add_argument(
        "--seed-file",
        default=str(ROOT_DIR / "backend" / "seeds" / "cnae_risks.seed.csv"),
        help="Caminho do CSV versionado de seed (default: backend/seeds/cnae_risks.seed.csv).",
    )
    args = parser.parse_args()

    seed_file = Path(args.seed_file).resolve()
    if not seed_file.exists():
        raise FileNotFoundError(f"Arquivo de seed nao encontrado: {seed_file}")

    inserted, updated, unchanged = load_seed(seed_file)
    total = inserted + updated + unchanged
    print(
        f"cnae_risks seed carregada: total={total} inserted={inserted} updated={updated} unchanged={unchanged}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
