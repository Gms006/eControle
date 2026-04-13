from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.models.company import Company
from app.schemas.copilot import CopilotCategory
from app.services.company_overview import build_company_overview
from app.services.copilot_document_analysis import analyze_document_payload
from app.services.copilot_domain_qa import answer_domain_question, needs_company_for_question
from app.services.copilot_provider import CopilotProviderClient
from app.services.copilot_simulation import simulate_company_risk_impact

OUT_OF_SCOPE_TOKENS = (
    "bitcoin",
    "criptomoeda",
    "filme",
    "serie",
    "futebol",
    "traduza",
    "receita de bolo",
)

COMPANY_REQUIRED_CATEGORIES = {
    CopilotCategory.COMPANY_SUMMARY,
    CopilotCategory.DOCUMENT_ANALYSIS,
    CopilotCategory.RISK_SIMULATION,
}

COMPANY_SUMMARY_PROMPT = """
Você é o Copiloto do eControle. Analise os dados da empresa abaixo e escreva um resumo
executivo em 2-3 parágrafos, como se estivesse fazendo um briefing rápido para um fiscal.

Destaque: situação geral de compliance, documentos próximos do vencimento, e qualquer
ponto de atenção. Seja objetivo. Não invente informações que não estejam nos dados.
"""


def _is_out_of_scope(message: str) -> bool:
    text = (message or "").strip().lower()
    return bool(text) and any(token in text for token in OUT_OF_SCOPE_TOKENS)


def _company_context(company: Company | None, overview: Any | None) -> dict[str, Any]:
    if not company:
        return {
            "company_id": None,
            "razao_social": None,
            "cnpj": None,
            "municipio": None,
            "risk_tier": None,
            "score_urgencia": None,
            "score_status": None,
        }
    return {
        "company_id": company.id,
        "razao_social": company.razao_social,
        "cnpj": company.cnpj,
        "municipio": company.municipio,
        "risk_tier": getattr(overview.score, "risk_tier", None) if overview else None,
        "score_urgencia": getattr(overview.score, "score_urgencia", None) if overview else None,
        "score_status": getattr(overview.score, "score_status", None) if overview else None,
    }


def _base_actions() -> list[dict[str, Any]]:
    return [
        {"id": "open-company", "label": "Abrir empresa", "action_type": "NAVIGATE", "target": "/painel?tab=empresas"},
        {"id": "go-licences", "label": "Ir para licenças", "action_type": "NAVIGATE", "target": "/painel?tab=licencas"},
        {"id": "go-processes", "label": "Ir para processos", "action_type": "NAVIGATE", "target": "/painel?tab=processos"},
        {"id": "go-taxes", "label": "Ir para taxas", "action_type": "NAVIGATE", "target": "/painel?tab=taxas"},
        {"id": "new-simulation", "label": "Nova simulação", "action_type": "RESET_CATEGORY", "target": "RISK_SIMULATION"},
        {"id": "switch-company", "label": "Trocar empresa", "action_type": "RESET_COMPANY"},
        {"id": "ask-general", "label": "Nova dúvida geral", "action_type": "RESET_CATEGORY", "target": "DUVIDAS_DIVERSAS"},
    ]


def _render_company_summary(overview: Any) -> tuple[str, list[dict[str, Any]], list[dict[str, str]], list[str]]:
    taxes_pending = [item for item in (overview.taxes or []) if item.urgency in {"warning", "critical"}]
    critical_licences = [item for item in (overview.licences or []) if item.critical]
    stale_processes = [item for item in (overview.processes or []) if item.stalled]
    next_due = overview.summary.next_due_items[:4] if overview and overview.summary else []

    sections = [
        {
            "id": "resumo",
            "title": "Resumo",
            "kind": "markdown",
            "content": (
                f"Risco atual: **{overview.score.risk_tier or 'N/D'}** | "
                f"Score de urgência: **{overview.score.score_urgencia if overview.score.score_urgencia is not None else 'N/D'}**."
            ),
            "items": [],
        },
        {
            "id": "evidencias",
            "title": "Evidências",
            "kind": "list",
            "content": "Sinais usados no diagnóstico:",
            "items": [
                f"{overview.summary.pending_taxes_count} taxa(s) com pendência",
                f"{overview.summary.critical_licences_count} licença(s) crítica(s)",
                f"{overview.summary.open_processes_count} processo(s) em aberto",
                f"Certificado: {overview.summary.certificate_status}",
            ],
        },
        {
            "id": "pendencias",
            "title": "Pendências",
            "kind": "list",
            "content": "Itens prioritários detectados:",
            "items": [
                *[f"Taxa: {item.tipo} ({item.status or 'sem status'})" for item in taxes_pending[:3]],
                *[f"Licença: {item.tipo} ({item.status or 'sem status'})" for item in critical_licences[:3]],
                *[f"Processo: {item.titulo} ({item.situacao or 'sem situação'})" for item in stale_processes[:2]],
            ]
            or ["Nenhuma pendência crítica detectada neste momento."],
        },
        {
            "id": "proximas-acoes",
            "title": "Próximas ações",
            "kind": "list",
            "content": "Plano sugerido para 30 dias:",
            "items": [
                *[
                    f"Priorizar {item.label} até {item.due_date.isoformat() if isinstance(item.due_date, date) else item.due_date}."
                    for item in next_due
                ],
                "Revisar processos sem atualização há mais de 7 dias úteis.",
                "Atualizar documentos que impactam score para reduzir urgência.",
            ][:6],
        },
    ]

    evidence = [
        {"label": "Score de urgência", "value": str(overview.score.score_urgencia or "N/D"), "source": "company_profiles"},
        {"label": "Risco consolidado", "value": str(overview.score.risk_tier or "N/D"), "source": "company_profiles"},
        {"label": "Taxas pendentes", "value": str(overview.summary.pending_taxes_count), "source": "company_taxes"},
    ]
    warnings = []
    if overview.summary.certificate_status == "NOT_FOUND":
        warnings.append("Certificado digital não encontrado no mirror local.")

    answer = (
        "Dossiê da empresa gerado com base em dados internos do eControle. "
        "Use as ações rápidas para abrir os módulos operacionais."
    )
    return answer, sections, evidence, warnings


def _company_summary_prompt_context(overview: Any, sections: list[dict[str, Any]], message: str) -> str:
    lines = [
        f"Solicitação do usuário: {message}",
        f"Risco consolidado: {overview.score.risk_tier or 'N/D'}",
        f"Score urgência: {overview.score.score_urgencia if overview.score.score_urgencia is not None else 'N/D'}",
        f"Taxas pendentes: {overview.summary.pending_taxes_count}",
        f"Licenças críticas: {overview.summary.critical_licences_count}",
        f"Processos em aberto: {overview.summary.open_processes_count}",
        f"Status certificado: {overview.summary.certificate_status}",
    ]
    for section in sections[:3]:
        lines.append(f"{section['title']}: {section.get('content', '')}")
        for item in section.get("items", [])[:2]:
            lines.append(f"- {item}")
    return "\n".join(lines)


def _resolve_company(db: Session, org_id: str, company_id: str | None) -> Company | None:
    if not company_id:
        return None
    return db.query(Company).filter(Company.id == company_id, Company.org_id == org_id).first()


def respond_to_copilot(
    db: Session,
    *,
    org_id: str,
    category: CopilotCategory,
    company_id: str | None,
    message: str,
    document_name: str | None = None,
    document_content_type: str | None = None,
    document_content: bytes | None = None,
) -> dict[str, Any]:
    company = _resolve_company(db, org_id, company_id)
    if company_id and company is None:
        raise ValueError("COMPANY_NOT_FOUND")

    if category in COMPANY_REQUIRED_CATEGORIES and company is None:
        raise ValueError("COMPANY_REQUIRED")

    overview = build_company_overview(db, org_id, company.id) if company else None
    provider = CopilotProviderClient()
    context = _company_context(company, overview)
    warnings: list[str] = []

    if _is_out_of_scope(message):
        return {
            "category": category,
            "company_context": context,
            "answer_markdown": (
                "Estou restrito ao escopo operacional do eControle. "
                "Escolha uma categoria: Entender empresa, Analisar documento, Simular impacto no risco ou Dúvidas diversas."
            ),
            "sections": [
                {
                    "id": "escopo",
                    "title": "Escopo permitido",
                    "kind": "list",
                    "content": "Posso ajudar com:",
                    "items": [
                        "Resumo e análise da empresa no eControle",
                        "Análise assistiva de documento (sem persistência)",
                        "Simulação de impacto no risco em memória",
                        "Dúvidas gerais sobre regras do domínio",
                    ],
                }
            ],
            "suggested_actions": _base_actions(),
            "warnings": [],
            "evidence": [],
            "simulation_result": None,
            "requires_company": False,
            "not_conclusive_reason": None,
            "grounding_used": False,
            "sources": [],
            "provider_info": provider.info(),
        }

    if category == CopilotCategory.DUVIDAS_DIVERSAS:
        requires_company = company is None and needs_company_for_question(message)
        if requires_company:
            return {
                "category": category,
                "company_context": context,
                "answer_markdown": "Para essa pergunta eu preciso da empresa selecionada.",
                "sections": [
                    {
                        "id": "empresa-obrigatoria",
                        "title": "Empresa necessária",
                        "kind": "list",
                        "content": "Selecione uma empresa para continuar.",
                        "items": [
                            "Essa pergunta depende de dados específicos da empresa.",
                            "Após selecionar, mantenha a mesma pergunta.",
                        ],
                    }
                ],
                "suggested_actions": [
                    {"id": "switch-company", "label": "Selecionar empresa", "action_type": "RESET_COMPANY"},
                    *_base_actions(),
                ],
                "warnings": [],
                "evidence": [],
                "simulation_result": None,
                "requires_company": True,
                "not_conclusive_reason": None,
                "grounding_used": False,
                "sources": [],
                "provider_info": provider.info(),
            }
        qa = answer_domain_question(
            message=message,
            company=company,
            company_context=context,
            provider=provider,
        )
        qa_actions = qa.get("suggested_actions") if isinstance(qa.get("suggested_actions"), list) else []
        return {
            "category": category,
            "company_context": context,
            "answer_markdown": qa["answer_markdown"],
            "sections": qa["sections"],
            "suggested_actions": [*qa_actions, *_base_actions()],
            "warnings": qa["warnings"],
            "evidence": qa["evidence"],
            "simulation_result": None,
            "requires_company": bool(qa.get("requires_company")),
            "not_conclusive_reason": qa.get("not_conclusive_reason"),
            "grounding_used": bool(qa.get("grounding_used")),
            "sources": qa.get("sources") or [],
            "provider_info": provider.info(),
        }

    if category == CopilotCategory.COMPANY_SUMMARY:
        answer, sections, evidence, category_warnings = _render_company_summary(overview)
        if provider.enabled:
            llm_answer = provider.generate(
                prompt=_company_summary_prompt_context(overview, sections, message),
                system_prompt=COMPANY_SUMMARY_PROMPT,
                category="COMPANY_SUMMARY",
            )
            if llm_answer:
                answer = llm_answer.strip()
        warnings.extend(category_warnings)
        return {
            "category": category,
            "company_context": context,
            "answer_markdown": answer,
            "sections": sections,
            "suggested_actions": _base_actions(),
            "warnings": warnings,
            "evidence": evidence,
            "simulation_result": None,
            "requires_company": False,
            "not_conclusive_reason": None,
            "grounding_used": False,
            "sources": [],
            "provider_info": provider.info(),
        }

    if category == CopilotCategory.RISK_SIMULATION:
        simulation = simulate_company_risk_impact(
            db,
            org_id=org_id,
            company_id=company.id,
            message=message,
        )
        sections = [
            {
                "id": "impacto",
                "title": "Impacto",
                "kind": "markdown",
                "content": (
                    f"Score atual: **{simulation['score_before']}** -> simulado: **{simulation['score_after']}** "
                    f"(delta: **{simulation['delta']}**)."
                ),
                "items": [],
            },
            {
                "id": "acoes-rapidas",
                "title": "Ações com maior impacto",
                "kind": "list",
                "content": "Top reduções estimadas:",
                "items": [
                    f"{item['field']}: delta {item['delta']}"
                    for item in simulation.get("top_impacts", [])
                ],
            },
        ]
        return {
            "category": category,
            "company_context": context,
            "answer_markdown": "Simulação concluída em memória sem alterar dados persistidos.",
            "sections": sections,
            "suggested_actions": _base_actions(),
            "warnings": warnings,
            "evidence": [
                {"label": "Base de cálculo", "value": "company_scoring (motor local)", "source": "company_scoring.py"},
            ],
            "simulation_result": simulation,
            "requires_company": False,
            "not_conclusive_reason": None,
            "grounding_used": False,
            "sources": [],
            "provider_info": provider.info(),
        }

    analysis = analyze_document_payload(
        provider=provider,
        filename=document_name,
        content_type=document_content_type,
        content=document_content,
        message=message,
        company_name=company.razao_social,
        company_municipio=company.municipio,
    )
    warnings.extend(analysis.get("warnings", []))
    classification = analysis.get("classification", {})
    sections = [
        {
            "id": "tipo-provavel",
            "title": "Tipo provável",
            "kind": "list",
            "content": "Classificação fechada do domínio:",
            "items": [
                f"Tipo: {classification.get('probable_document_type', 'NAO_CONCLUSIVO')}",
                f"Confiança: {classification.get('confidence', 0.0):.2f}",
            ],
        },
        {
            "id": "evidencias",
            "title": "Evidências",
            "kind": "list",
            "content": "Trechos que suportam a conclusão:",
            "items": classification.get("evidence_snippets", []) or ["Sem evidências suficientes."],
        },
        {
            "id": "campos-extraidos",
            "title": "Campos extraídos",
            "kind": "list",
            "content": "Extração factual:",
            "items": [
                f"{key}: {value}" for key, value in (classification.get("extracted_fields") or {}).items() if value
            ]
            or ["Nenhum campo extraído com confiança."],
        },
        {
            "id": "conflitos",
            "title": "Conflitos",
            "kind": "list",
            "content": "Comparação com contexto da empresa:",
            "items": classification.get("conflicts", []) or ["Nenhum conflito explícito detectado."],
        },
        {
            "id": "acao-manual",
            "title": "Ação sugerida",
            "kind": "markdown",
            "content": str(classification.get("recommended_manual_action") or "Revisar manualmente."),
            "items": [],
        },
    ]
    return {
        "category": category,
        "company_context": context,
        "answer_markdown": str(analysis.get("summary") or "Análise de documento concluída em modo assistivo."),
        "sections": sections,
        "suggested_actions": _base_actions(),
        "warnings": warnings,
        "evidence": [
            {"label": "Arquivo", "value": document_name or "não informado", "source": "upload temporário"},
            {"label": "Tipo detectado", "value": classification.get("probable_document_type", "NAO_CONCLUSIVO"), "source": "pipeline documental"},
        ],
        "simulation_result": None,
        "requires_company": False,
        "not_conclusive_reason": classification.get("not_conclusive_reason"),
        "grounding_used": False,
        "sources": [],
        "provider_info": provider.info(),
    }
