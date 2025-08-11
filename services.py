from __future__ import annotations
import json
from dataclasses import asdict
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, Generic, Iterable, List, Optional, Type, TypeVar
from uuid import UUID

from pydantic import BaseModel

from core.schemas import Empresa, Licenca, Taxa, Processo, ChecklistItem
from core.enums import TaxaSituacao, ProcessoSituacao

T = TypeVar("T", bound=BaseModel)


class JsonlStore(Generic[T]):
    """Armazenamento simples em JSON Lines (um registro por linha).
    Útil para MVP sem depender de banco.
    """

    def __init__(self, base_dir: Path, name: str, model: Type[T]):
        self.path = base_dir / f"{name}.jsonl"
        self.model = model
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.touch(exist_ok=True)

    def _load_all(self) -> List[T]:
        items: List[T] = []
        with self.path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                data = json.loads(line)
                items.append(self.model.model_validate(data))
        return items

    def _dump_all(self, items: Iterable[T]) -> None:
        with self.path.open("w", encoding="utf-8") as f:
            for item in items:
                f.write(json.dumps(item.model_dump(mode="json"), ensure_ascii=False))
                f.write("\n")

    def list(self) -> List[T]:
        return self._load_all()

    def get(self, id_: UUID) -> Optional[T]:
        for item in self._load_all():
            if str(item.id) == str(id_):
                return item
        return None

    def upsert(self, obj: T) -> T:
        items = self._load_all()
        found = False
        for i, it in enumerate(items):
            if str(it.id) == str(obj.id):
                items[i] = obj
                found = True
                break
        if not found:
            items.append(obj)
        self._dump_all(items)
        return obj

    def delete(self, id_: UUID) -> bool:
        items = [it for it in self._load_all() if str(it.id) != str(id_)]
        self._dump_all(items)
        return True


class Services:
    """Fachada de serviços do domínio."""

    def __init__(self, base_dir: str = "data/exports"):
        base = Path(base_dir)
        self.empresas = JsonlStore[Empresa](base, "empresas", Empresa)
        self.licencas = JsonlStore[Licenca](base, "licencas", Licenca)
        self.taxas = JsonlStore[Taxa](base, "taxas", Taxa)
        self.processos = JsonlStore[Processo](base, "processos", Processo)
        self.checklists = JsonlStore[ChecklistItem](base, "checklists", ChecklistItem)

    # ----------------------
    # Empresas
    # ----------------------
    def list_empresas(self) -> List[Empresa]:
        return self.empresas.list()

    def get_empresa(self, id_: UUID) -> Optional[Empresa]:
        return self.empresas.get(id_)

    def save_empresa(self, e: Empresa) -> Empresa:
        return self.empresas.upsert(e)

    def delete_empresa(self, id_: UUID) -> bool:
        return self.empresas.delete(id_)

    # ----------------------
    # Licenças
    # ----------------------
    def list_licencas(self, id_empresa: Optional[UUID] = None) -> List[Licenca]:
        items = self.licencas.list()
        if id_empresa:
            items = [i for i in items if str(i.id_empresa) == str(id_empresa)]
        return items

    # ----------------------
    # Taxas
    # ----------------------
    def list_taxas(self, id_empresa: Optional[UUID] = None) -> List[Taxa]:
        items = self.taxas.list()
        if id_empresa:
            items = [i for i in items if str(i.id_empresa) == str(id_empresa)]
        return items

    # ----------------------
    # Processos
    # ----------------------
    def list_processos(self, id_empresa: Optional[UUID] = None) -> List[Processo]:
        items = self.processos.list()
        if id_empresa:
            items = [i for i in items if str(i.id_empresa) == str(id_empresa)]
        return items

    # ----------------------
    # Checklists
    # ----------------------
    def list_checklists(self, id_processo: Optional[UUID] = None) -> List[ChecklistItem]:
        items = self.checklists.list()
        if id_processo:
            items = [i for i in items if str(i.id_processo) == str(id_processo)]
        return items

    # ----------------------
    # Métricas (Overview)
    # ----------------------
    def metrics_overview(self) -> dict:
        today = date.today()
        d30 = today + timedelta(days=30)

        licencas_vencendo = 0
        for l in self.licencas.list():
            if l.validade and today <= l.validade <= d30:
                licencas_vencendo += 1

        taxas_em_aberto = sum(
            1 for t in self.taxas.list() if t.situacao in {
                TaxaSituacao.EM_ABERTO,
                TaxaSituacao.PARCELADO,
                TaxaSituacao.ANOS_ANTERIORES_ABERTO,
            }
        )

        processos_pendentes = sum(
            1 for p in self.processos.list() if p.situacao not in {
                ProcessoSituacao.CONCLUIDO,
                ProcessoSituacao.LICENCIADO,
                ProcessoSituacao.INDEFERIDO,
            }
        )

        return {
            "empresas": len(self.empresas.list()),
            "licencas_vencendo": licencas_vencendo,
            "taxas_em_aberto": taxas_em_aberto,
            "processos_pendentes": processos_pendentes,
        }
