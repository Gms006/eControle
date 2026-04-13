from __future__ import annotations

import base64
import io
import json
import re
from datetime import datetime
from typing import Any

from app.services.copilot_provider import CopilotProviderClient

try:
    from pypdf import PdfReader  # type: ignore
except Exception:  # pragma: no cover
    PdfReader = None  # type: ignore

try:
    import pypdfium2 as pdfium  # type: ignore
except Exception:  # pragma: no cover
    pdfium = None  # type: ignore

ALLOWED_DOCUMENT_TYPES = {
    "CND_MUNICIPAL",
    "CND_ESTADUAL",
    "CND_FEDERAL",
    "ALVARA_FUNCIONAMENTO",
    "ALVARA_SANITARIO",
    "LICENCA_AMBIENTAL",
    "CERTIFICADO_BOMBEIROS",
    "USO_DO_SOLO",
    "OUTRO",
    "NAO_CONCLUSIVO",
}

HUMAN_SUMMARY_PROMPT = """
Você é o Copiloto do eControle. Com base na análise técnica abaixo, escreva UM parágrafo
curto e direto explicando o resultado para o usuário de forma simples.

Não repita os campos técnicos. Fale como se estivesse explicando para o dono da empresa
o que o documento é e se está tudo ok ou há algo para atenção.
Se houver conflitos ou warnings, mencione de forma clara mas sem alarmar desnecessariamente.

Análise técnica:
{json_resultado_classificacao}
"""


def _humanize_result_fallback(result: dict, company_name: str | None) -> str:
    tipo = result.get("probable_document_type", "desconhecido")
    confianca = result.get("confidence", 0)
    situacao = result.get("extracted_fields", {}).get("situacao_aparente", "")
    validade = result.get("extracted_fields", {}).get("validade", "")
    conflitos = result.get("conflicts", [])
    nao_conclusivo = result.get("not_conclusive_reason", "")

    if confianca >= 0.90:
        confianca_txt = "com alta confiança"
    elif confianca >= 0.70:
        confianca_txt = "com confiança razoável"
    else:
        confianca_txt = "mas a confiança é baixa — vale conferir manualmente"

    linhas: list[str] = []

    if tipo == "NAO_CONCLUSIVO":
        linhas.append(
            f"Não foi possível identificar o tipo do documento com clareza. "
            f"{nao_conclusivo or 'O conteúdo não apresentou evidências suficientes.'} "
            f"Recomendo verificar manualmente antes de cadastrar."
        )
    else:
        tipo_legivel = str(tipo).replace("_", " ").title()
        linhas.append(
            f"O documento parece ser uma **{tipo_legivel}** {confianca_txt}."
        )

    if situacao:
        if "negativa" in str(situacao).lower():
            linhas.append("A situação aparente é **regular (negativa de débitos)** — boa notícia.")
        elif "positiva" in str(situacao).lower():
            linhas.append("⚠️ A situação aparente indica **débitos em aberto**. Atenção antes de cadastrar.")
        else:
            linhas.append(f"Situação aparente identificada: **{situacao}**.")

    if validade:
        linhas.append(f"Data de validade extraída: **{validade}**.")

    if conflitos:
        linhas.append(
            f"Foram detectados **{len(conflitos)} conflito(s)** em relação ao cadastro"
            + (f" de {company_name}" if company_name else "")
            + ". Verifique antes de salvar."
        )

    linhas.append("Confirme os dados manualmente antes de cadastrar ou atualizar o sistema.")

    return "\n\n".join(linhas)


def _safe_decode(content: bytes) -> str:
    return content.decode("utf-8", errors="ignore") or content.decode("latin-1", errors="ignore")


def _detect_file_kind(filename: str | None, content_type: str | None, content: bytes) -> str:
    lowered_name = str(filename or "").lower()
    lowered_type = str(content_type or "").lower()
    if lowered_type.startswith("application/pdf") or lowered_name.endswith(".pdf") or content.startswith(b"%PDF"):
        return "pdf"
    if lowered_type.startswith("image/") or lowered_name.endswith((".png", ".jpg", ".jpeg", ".webp")):
        return "image"
    return "other"


def _extract_pdf_text(content: bytes, max_pages: int = 3) -> tuple[str, list[str]]:
    warnings: list[str] = []
    if PdfReader is None:
        return "", ["Extração de texto PDF indisponível (dependência pypdf não instalada)."]
    try:
        reader = PdfReader(io.BytesIO(content))
        fragments: list[str] = []
        for index, page in enumerate(reader.pages[:max_pages]):
            extracted = page.extract_text() or ""
            if extracted.strip():
                fragments.append(f"[P{index + 1}] {extracted.strip()}")
        if not fragments:
            warnings.append("PDF sem texto extraível nas primeiras páginas.")
        return "\n".join(fragments), warnings
    except Exception:
        return "", ["Falha ao extrair texto do PDF."]


def _render_pdf_pages_as_base64_png(content: bytes, max_pages: int = 2) -> tuple[list[str], list[str]]:
    warnings: list[str] = []
    if pdfium is None:
        return [], ["Renderização de páginas PDF indisponível (pypdfium2 não instalado)."]
    images: list[str] = []
    try:
        doc = pdfium.PdfDocument(io.BytesIO(content))
        pages_total = min(len(doc), max_pages)
        for page_index in range(pages_total):
            page = doc[page_index]
            pil_image = page.render(scale=1.3).to_pil()
            buffer = io.BytesIO()
            pil_image.save(buffer, format="PNG")
            images.append(base64.b64encode(buffer.getvalue()).decode("ascii"))
        if not images:
            warnings.append("Não foi possível renderizar páginas do PDF.")
        return images, warnings
    except Exception:
        return [], ["Falha ao renderizar páginas do PDF."]


def _extract_validade(text: str) -> str | None:
    for candidate in re.findall(r"\b(\d{2}/\d{2}/\d{4}|\d{4}-\d{2}-\d{2})\b", text):
        try:
            if "/" in candidate:
                parsed = datetime.strptime(candidate, "%d/%m/%Y")
            else:
                parsed = datetime.strptime(candidate, "%Y-%m-%d")
            return parsed.date().isoformat()
        except ValueError:
            continue
    return None


def _rule_based_classification(text: str) -> tuple[str, float, list[str]]:
    lowered = text.lower()
    evidence: list[str] = []
    if ("certidão" in lowered or "certidao" in lowered) and "negativa" in lowered and "municip" in lowered:
        evidence.append("Menção textual de certidão negativa municipal.")
        return "CND_MUNICIPAL", 0.93, evidence
    if ("certidão" in lowered or "certidao" in lowered) and "negativa" in lowered and ("estad" in lowered or "estado" in lowered):
        evidence.append("Menção textual de certidão negativa estadual.")
        return "CND_ESTADUAL", 0.91, evidence
    if ("certidão" in lowered or "certidao" in lowered) and "negativa" in lowered and ("federal" in lowered or "união" in lowered or "uniao" in lowered):
        evidence.append("Menção textual de certidão negativa federal.")
        return "CND_FEDERAL", 0.91, evidence
    if ("alvará" in lowered or "alvara" in lowered) and "funcionamento" in lowered:
        evidence.append("Menção textual de alvará de funcionamento.")
        return "ALVARA_FUNCIONAMENTO", 0.9, evidence
    if ("alvará" in lowered or "alvara" in lowered) and "sanit" in lowered:
        evidence.append("Menção textual de alvará sanitário.")
        return "ALVARA_SANITARIO", 0.9, evidence
    if ("licença" in lowered or "licenca" in lowered) and "ambient" in lowered:
        evidence.append("Menção textual de licença ambiental.")
        return "LICENCA_AMBIENTAL", 0.89, evidence
    if "bombeiro" in lowered or "cercon" in lowered or "corpo de bombeiros" in lowered:
        evidence.append("Menção textual de bombeiros/CERCON.")
        return "CERTIFICADO_BOMBEIROS", 0.86, evidence
    if ("uso do solo" in lowered) or ("certidão de uso" in lowered) or ("certidao de uso" in lowered):
        evidence.append("Menção textual de uso do solo.")
        return "USO_DO_SOLO", 0.86, evidence
    if lowered.strip():
        evidence.append("Texto sem marcadores suficientes para tipo fechado.")
        return "NAO_CONCLUSIVO", 0.25, evidence
    return "NAO_CONCLUSIVO", 0.0, ["Sem texto útil extraído."]


def _extract_fields_from_text(text: str) -> dict[str, Any]:
    orgao_match = re.search(r"\b(prefeitura|secretaria|bombeiros|receita federal|sefaz)\b", text, re.I)
    municipio_match = re.search(r"\b(an[aá]polis|goi[aâ]nia|aparecida de goi[aâ]nia)\b", text, re.I)
    numero_match = re.search(r"\b(?:n[ºo°.]?|numero)\s*[:\-]?\s*([A-Z0-9./-]{4,})\b", text, re.I)
    razao_match = re.search(r"\b(?:raz[aã]o social|empresa)\s*[:\-]?\s*([^\n]{4,80})\b", text, re.I)
    emissao_match = re.search(r"\b(?:emiss[aã]o|emitida em)\s*[:\-]?\s*(\d{2}/\d{2}/\d{4}|\d{4}-\d{2}-\d{2})\b", text, re.I)
    situacao = "negativa" if re.search(r"\bnegativ[ao]\b", text, re.I) else None
    return {
        "razao_social": razao_match.group(1).strip() if razao_match else None,
        "municipio": municipio_match.group(1) if municipio_match else None,
        "orgao_emissor": orgao_match.group(1) if orgao_match else None,
        "numero_documento": numero_match.group(1) if numero_match else None,
        "data_emissao": emissao_match.group(1) if emissao_match else None,
        "validade": _extract_validade(text),
        "situacao_aparente": situacao,
    }


def _company_conflicts(extracted_fields: dict[str, Any], company_name: str, company_municipio: str | None) -> list[str]:
    conflicts: list[str] = []
    doc_name = str(extracted_fields.get("razao_social") or "").strip().lower()
    if doc_name and company_name and company_name.lower() not in doc_name:
        conflicts.append("Razão social do documento não coincide claramente com a empresa selecionada.")
    doc_municipio = str(extracted_fields.get("municipio") or "").strip().lower()
    if doc_municipio and company_municipio and company_municipio.lower() != doc_municipio:
        conflicts.append("Município do documento difere do cadastro atual da empresa.")
    return conflicts


def _strict_document_prompt(*, message: str, extracted_text: str, file_kind: str) -> str:
    return (
        "Você é um classificador documental do eControle.\n"
        "REGRAS OBRIGATÓRIAS:\n"
        "1) Use apenas tipos permitidos: "
        + ", ".join(sorted(ALLOWED_DOCUMENT_TYPES))
        + ".\n"
        "2) Nunca expanda siglas sem evidência textual explícita no documento.\n"
        "3) Nunca classifique com base apenas no nome do arquivo.\n"
        "4) Se evidência insuficiente, retorne NAO_CONCLUSIVO.\n"
        "5) Responda SOMENTE JSON com chaves: probable_document_type, confidence, evidence_snippets, extracted_fields, conflicts, recommended_manual_action, not_conclusive_reason.\n"
        f"Pergunta do usuário: {message}\n"
        f"Tipo de arquivo detectado: {file_kind}\n"
        f"Texto extraído:\n{extracted_text[:10000]}"
    )


def _normalize_provider_payload(data: dict[str, Any]) -> dict[str, Any]:
    probable = str(data.get("probable_document_type") or "NAO_CONCLUSIVO").strip().upper()
    if probable not in ALLOWED_DOCUMENT_TYPES:
        probable = "NAO_CONCLUSIVO"
    confidence = float(data.get("confidence") or 0.0)
    evidence = [str(item) for item in (data.get("evidence_snippets") or []) if str(item).strip()]
    extracted_fields = data.get("extracted_fields") if isinstance(data.get("extracted_fields"), dict) else {}
    conflicts = [str(item) for item in (data.get("conflicts") or []) if str(item).strip()]
    return {
        "probable_document_type": probable,
        "confidence": max(0.0, min(confidence, 1.0)),
        "evidence_snippets": evidence,
        "extracted_fields": extracted_fields,
        "conflicts": conflicts,
        "recommended_manual_action": str(data.get("recommended_manual_action") or "").strip() or "Revisar manualmente antes de qualquer atualização.",
        "not_conclusive_reason": str(data.get("not_conclusive_reason") or "").strip() or None,
    }


def _extract_json_object(raw_text: str) -> dict[str, Any] | None:
    text = str(raw_text or "").strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        pass

    fence_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text, re.I)
    if fence_match:
        candidate = fence_match.group(1).strip()
        try:
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            pass

    first = text.find("{")
    last = text.rfind("}")
    if first >= 0 and last > first:
        candidate = text[first : last + 1]
        try:
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None
    return None


def _provider_document_classification(
    *,
    provider: CopilotProviderClient,
    message: str,
    file_kind: str,
    extracted_text: str,
    rendered_images_b64: list[str],
) -> dict[str, Any] | None:
    prompt = _strict_document_prompt(message=message, extracted_text=extracted_text, file_kind=file_kind)
    output = provider.generate(
        prompt=prompt,
        images_b64=rendered_images_b64 if rendered_images_b64 else None,
        category="DOCUMENT_ANALYSIS",
        enable_web_search=False,
    )
    if not output:
        return None
    parsed = _extract_json_object(output)
    if not parsed:
        return None
    return _normalize_provider_payload(parsed)


def _human_summary_from_provider(
    *,
    provider: CopilotProviderClient,
    classification: dict[str, Any],
    warnings: list[str],
) -> str | None:
    if not provider.enabled:
        return None
    technical_payload = {
        "classification": classification,
        "warnings": warnings,
    }
    prompt = HUMAN_SUMMARY_PROMPT.format(
        json_resultado_classificacao=json.dumps(technical_payload, ensure_ascii=False, indent=2)
    )
    response = provider.generate(
        prompt=prompt,
        category="DOCUMENT_ANALYSIS",
        enable_web_search=False,
    )
    if not response:
        return None
    rendered = str(response).strip()
    return rendered or None


def analyze_document_payload(
    *,
    provider: CopilotProviderClient,
    filename: str | None,
    content_type: str | None,
    content: bytes | None,
    message: str,
    company_name: str,
    company_municipio: str | None = None,
) -> dict[str, Any]:
    safe_filename = (filename or "").strip()
    if not content:
        empty_classification = {
            "probable_document_type": "NAO_CONCLUSIVO",
            "confidence": 0.0,
            "evidence_snippets": [],
            "extracted_fields": {},
            "conflicts": [],
            "recommended_manual_action": "Anexar um documento válido para análise assistiva.",
            "not_conclusive_reason": "Sem arquivo.",
        }
        return {
            "summary": _humanize_result_fallback(empty_classification, company_name),
            "warnings": ["Envie um PDF ou imagem para habilitar análise de documento no copiloto."],
            "classification": empty_classification,
        }

    warnings: list[str] = []
    file_kind = _detect_file_kind(safe_filename, content_type, content)
    extracted_text = ""
    rendered_images_b64: list[str] = []

    if file_kind == "pdf":
        extracted_text, extraction_warnings = _extract_pdf_text(content, max_pages=3)
        warnings.extend(extraction_warnings)
        rendered_images_b64, render_warnings = _render_pdf_pages_as_base64_png(content, max_pages=2)
        warnings.extend(render_warnings)
        if not extracted_text.strip() and not rendered_images_b64:
            unreadable_classification = {
                "probable_document_type": "NAO_CONCLUSIVO",
                "confidence": 0.0,
                "evidence_snippets": [],
                "extracted_fields": {},
                "conflicts": [],
                "recommended_manual_action": "Reenviar PDF legível ou imagem mais nítida.",
                "not_conclusive_reason": "Sem texto extraído e sem renderização de páginas.",
            }
            return {
                "summary": _humanize_result_fallback(unreadable_classification, company_name),
                "warnings": warnings or ["Falha na leitura do PDF."],
                "classification": unreadable_classification,
            }
    elif file_kind == "image":
        extracted_text = _safe_decode(content[:120000])
    else:
        extracted_text = _safe_decode(content[:120000])
        warnings.append("Tipo de arquivo fora do padrão esperado; análise pode ser limitada.")

    provider_result = _provider_document_classification(
        provider=provider,
        message=message,
        file_kind=file_kind,
        extracted_text=extracted_text,
        rendered_images_b64=rendered_images_b64,
    )

    if provider_result:
        base = provider_result
    else:
        doc_type, confidence, evidence = _rule_based_classification(extracted_text)
        base = {
            "probable_document_type": doc_type,
            "confidence": confidence,
            "evidence_snippets": evidence,
            "extracted_fields": _extract_fields_from_text(extracted_text),
            "conflicts": [],
            "recommended_manual_action": "Confirmar manualmente antes de cadastrar ou atualizar dados.",
            "not_conclusive_reason": "Evidência insuficiente para classificação conclusiva." if doc_type == "NAO_CONCLUSIVO" else None,
        }
        warnings.append("Classificação em modo determinístico local (provider indisponível ou saída inválida).")

    extracted_fields = dict(base.get("extracted_fields") or {})
    if not extracted_fields:
        extracted_fields = _extract_fields_from_text(extracted_text)

    conflicts = [str(item) for item in (base.get("conflicts") or []) if str(item).strip()]
    conflicts.extend(_company_conflicts(extracted_fields, company_name, company_municipio))

    normalized = _normalize_provider_payload(
        {
            **base,
            "extracted_fields": extracted_fields,
            "conflicts": conflicts,
        }
    )
    if normalized["probable_document_type"] == "NAO_CONCLUSIVO" and not normalized["not_conclusive_reason"]:
        normalized["not_conclusive_reason"] = "Sem evidência textual suficiente para tipo fechado."

    human_summary = None
    if provider_result:
        human_summary = _human_summary_from_provider(
            provider=provider,
            classification=normalized,
            warnings=warnings,
        )

    fallback_summary = _humanize_result_fallback(normalized, company_name)
    return {
        "summary": human_summary or fallback_summary,
        "warnings": warnings,
        "classification": normalized,
    }
