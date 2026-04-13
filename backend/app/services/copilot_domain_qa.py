from __future__ import annotations

from typing import Any

from app.models.company import Company
from app.services.copilot_provider import CopilotProviderClient, CopilotProviderError
from app.services.copilot_web_search import should_search_web

COMPANY_REQUIRED_TOKENS = (
    "essa empresa",
    "desta empresa",
    "da empresa",
    "esta empresa",
    "ela",
)

SYSTEM_PROMPT = """
Você é o Copiloto do eControle, especialista em compliance municipal, licenças e riscos.

Regras:
- Seja objetivo, técnico e curto.
- Não invente fatos nem legislação.
- Quando houver fontes externas, use-as de forma crítica e cite apenas o que estiver evidenciado.
- Quando faltar evidência, diga explicitamente.
- Priorize dados internos da empresa quando a pergunta for sobre contexto interno.
"""


def needs_company_for_question(message: str) -> bool:
    text = (message or "").strip().lower()
    if not text:
        return False
    return any(token in text for token in COMPANY_REQUIRED_TOKENS)


def answer_domain_question(
    *,
    message: str,
    company: Company | None = None,
    company_context: dict[str, Any] | None = None,
    provider: CopilotProviderClient | None = None,
) -> dict[str, Any]:
    text = (message or "").strip().lower()
    sections: list[dict[str, Any]] = []
    evidence: list[dict[str, str]] = []
    warnings: list[str] = []

    if ("tpi" in text) and company is None and ("essa empresa" in text or "desta empresa" in text):
        return {
            "answer_markdown": "Para responder essa pergunta com precisão, selecione uma empresa.",
            "sections": [
                {
                    "id": "empresa-obrigatoria",
                    "title": "Empresa necessária",
                    "kind": "list",
                    "content": "Essa pergunta depende de contexto específico.",
                    "items": [
                        "Selecione a empresa no Copiloto",
                        "Refaça a pergunta para obter análise contextual",
                    ],
                }
            ],
            "evidence": [],
            "warnings": [],
            "requires_company": True,
            "not_conclusive_reason": None,
            "grounding_used": False,
            "sources": [],
        }

    if "tpi" in text:
        sections.append(
            {
                "id": "tpi-base",
                "title": "TPI no domínio",
                "kind": "list",
                "content": "Visão operacional no eControle:",
                "items": [
                    "TPI aparece no domínio de Taxas e impacta regularidade tributária.",
                    "Situações em aberto elevam prioridade operacional.",
                    "A confirmação final depende de dados da empresa e status cadastral.",
                ],
            }
        )
        evidence.append({"label": "Fonte", "value": "company_taxes / regras de status", "source": "domínio interno"})
    elif "cnae" in text and ("risco" in text or "anápolis" in text or "anapolis" in text):
        sections.append(
            {
                "id": "cnae-risco",
                "title": "CNAE e risco",
                "kind": "list",
                "content": "Resumo do motor atual:",
                "items": [
                    "Risco é derivado de catálogo CNAE (`cnae_risks`) e vencimentos de licenças.",
                    "Tier e peso base são combinados no score de urgência.",
                    "Contexto municipal pode influenciar regras operacionais associadas.",
                ],
            }
        )
        evidence.append({"label": "Fonte", "value": "company_scoring + cnae_risks", "source": "domínio interno"})
    elif ("alvará" in text or "alvara" in text or "certidão" in text or "certidao" in text or "cnd" in text):
        sections.append(
            {
                "id": "docs-diferencas",
                "title": "Licença vs certidão",
                "kind": "list",
                "content": "Diferença operacional:",
                "items": [
                    "Alvará/licença: autorização de funcionamento ou conformidade operacional.",
                    "CND/certidão: comprovação de regularidade para um recorte fiscal/administrativo.",
                    "Exigência e periodicidade variam por órgão e município.",
                ],
            }
        )
        evidence.append({"label": "Fonte", "value": "processos/licenças/taxas", "source": "domínio interno"})
    elif "score" in text or "urgência" in text or "urgencia" in text:
        sections.append(
            {
                "id": "score-urgencia",
                "title": "Score de urgência",
                "kind": "list",
                "content": "O que influencia o score:",
                "items": [
                    "Peso base do CNAE mapeado no catálogo.",
                    "Proximidade de vencimento das licenças críticas.",
                    "Status de mapeamento CNAE e disponibilidade de dados.",
                ],
            }
        )
        evidence.append({"label": "Fonte", "value": "company_scoring.py", "source": "serviço interno"})
    else:
        warnings.append("Pergunta pouco específica para resposta assertiva.")
        sections.append(
            {
                "id": "nao-conclusivo",
                "title": "Não conclusivo",
                "kind": "list",
                "content": "Refine a pergunta dentro do escopo do eControle.",
                "items": [
                    "Taxas/TPI",
                    "CNAE e risco",
                    "Licenças/certidões",
                    "Score de urgência",
                    "Processos e pendências",
                ],
            }
        )
        return {
            "answer_markdown": "Não conclusivo com os dados da pergunta atual.",
            "sections": sections,
            "evidence": evidence,
            "warnings": warnings,
            "requires_company": False,
            "not_conclusive_reason": "Pergunta genérica sem referência operacional suficiente.",
            "grounding_used": False,
            "sources": [],
        }

    if company and company_context:
        sections.append(
            {
                "id": "empresa-contexto",
                "title": "Contexto da empresa",
                "kind": "list",
                "content": "Recorte aplicado:",
                "items": [
                    f"Empresa: {company.razao_social}",
                    f"Município: {company.municipio or 'N/D'}",
                    f"Score atual: {company_context.get('score_urgencia', 'N/D')}",
                ],
            }
        )
        evidence.append({"label": "Empresa", "value": company.razao_social, "source": "companies"})

    deterministic_answer = "Resposta gerada com base em regras e dados do domínio eControle."
    llm_answer: str | None = None
    source_actions: list[dict[str, Any]] = []
    sources: list[dict[str, str]] = []
    grounding_used = False

    if provider and provider.enabled:
        context_lines = []
        if company:
            context_lines.append(f"Empresa: {company.razao_social}")
            context_lines.append(f"Município: {company.municipio or 'N/D'}")
        if company_context:
            context_lines.append(f"Score atual: {company_context.get('score_urgencia', 'N/D')}")
            context_lines.append(f"Risco atual: {company_context.get('risk_tier', 'N/D')}")
        summary_points = []
        for section in sections[:3]:
            summary_points.append(f"{section['title']}: {section['content']}")
            for item in section.get("items", [])[:2]:
                summary_points.append(f"- {item}")
        llm_prompt = (
            f"Pergunta do usuário: {message}\n"
            f"Contexto: {' | '.join(context_lines) if context_lines else 'Sem empresa selecionada'}\n"
            "Base factual interna:\n"
            + "\n".join(summary_points[:10])
        )

        use_web_search = should_search_web(message, company_context=company_context)
        try:
            llm_answer = provider.generate(
                prompt=llm_prompt,
                system_prompt=SYSTEM_PROMPT,
                category="DUVIDAS_DIVERSAS",
                enable_web_search=use_web_search,
                require_provider=True,
            )
        except CopilotProviderError:
            raise
        metadata = provider.last_call_metadata()
        grounding_used = bool(metadata.get("web_search_used"))
        sources = [
            {
                "title": str(item.get("title") or "").strip() or str(item.get("url") or "").strip(),
                "url": str(item.get("url") or "").strip(),
                "snippet": str(item.get("snippet") or "").strip(),
            }
            for item in (metadata.get("sources") or [])
            if str(item.get("url") or "").strip()
        ]
        source_actions = [
            {
                "label": f"Ver fonte: {item['title'][:40]}",
                "url": item["url"],
            }
            for item in sources
        ]

    return {
        "answer_markdown": (llm_answer or deterministic_answer).strip(),
        "sections": sections,
        "evidence": evidence,
        "warnings": warnings,
        "requires_company": False,
        "not_conclusive_reason": None,
        "suggested_actions": source_actions,
        "grounding_used": grounding_used,
        "sources": sources,
    }
