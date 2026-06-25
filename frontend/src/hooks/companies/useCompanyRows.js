import React from "react";
import dayjs from "dayjs";
import { TAXA_TYPE_KEYS } from "@/lib/constants";
import { categorizeCertificadoSituacao, resolveEmpresaCertificadoSituacao } from "@/lib/certificados";
import { parseDateLike } from "@/lib/date";
import { formatMunicipioDisplay } from "@/lib/normalization";
import { getStatusKey, hasPendingFraction, hasRelevantStatus, isAlertStatus, isProcessStatusInactive } from "@/lib/domain/status/common";
import { onlyDigits } from "@/lib/quickLinks";

const PLACEHOLDER_CNAE_CODE = "00.00-0-00";

const resolveEmpresaIdValue = (empresa, extractEmpresaId) =>
  extractEmpresaId?.(empresa) ??
  empresa?.empresa_id ??
  empresa?.empresaId ??
  empresa?.company_id ??
  empresa?.companyId ??
  empresa?.id;

const companyDocumentDigits = (item) =>
  onlyDigits(item?.cnpj ?? item?.company_cpf ?? item?.cnpj_empresa ?? item?.cnpjEmpresa ?? "");

const companyDocumentValue = (item) => item?.cnpj || item?.company_cpf || "";

const findListByEmpresa = (map, empresaId, empresaCnpj) => {
  if (empresaId && map?.has(empresaId)) return map.get(empresaId) || [];
  const target = onlyDigits(empresaCnpj || "");
  if (!target) return [];
  for (const value of map?.values?.() || []) {
    const list = Array.isArray(value) ? value : [value];
    const matched = list.filter((entry) => companyDocumentDigits(entry) === target);
    if (matched.length > 0) return matched;
  }
  return [];
};

const findTaxaByEmpresa = (map, empresaId, empresaCnpj) => {
  if (empresaId && map?.has(empresaId)) return map.get(empresaId);
  const target = onlyDigits(empresaCnpj || "");
  if (!target) return undefined;
  for (const taxa of map?.values?.() || []) {
    if (companyDocumentDigits(taxa) === target) return taxa;
  }
  return undefined;
};

const isTaxaDebitoStatus = (status) => {
  const key = getStatusKey(status || "");
  if (!key) return false;
  if (key.includes("abert")) return true;
  if (!key.includes("parcelad")) return false;
  if (hasPendingFraction(status)) return true;
  return !key.includes("quitad") && !key.includes("pago");
};

const hasDebito = (taxa) => {
  if (!taxa) return false;
  return (
    TAXA_TYPE_KEYS.some((taxaKey) => isTaxaDebitoStatus(taxa?.[taxaKey])) ||
    isTaxaDebitoStatus(taxa?.status_taxas)
  );
};

const hasValidCertificado = (empresa, certificadoIndex) => {
  const situacao = resolveEmpresaCertificadoSituacao(empresa, certificadoIndex);
  return categorizeCertificadoSituacao(situacao) === "VALIDO";
};

const critico7dias = (lics) =>
  (lics || []).some((lic) => {
    const parsed = parseDateLike(lic?.validade || lic?.validade_br);
    if (!parsed) return false;
    const days = parsed.startOf("day").diff(dayjs().startOf("day"), "day");
    return days >= 0 && days <= 7;
  });

const normalizeCode = (value) => String(value || "").trim().toUpperCase();
const normalizeRisk = (value) => String(value || "").trim().toLowerCase();

const getUsefulCnaes = (empresa) => {
  const all = [
    ...(Array.isArray(empresa?.cnaes_principal) ? empresa.cnaes_principal : []),
    ...(Array.isArray(empresa?.cnaes_secundarios) ? empresa.cnaes_secundarios : []),
  ];
  return all.filter((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const code = normalizeCode(entry.code);
    return Boolean(code) && code !== PLACEHOLDER_CNAE_CODE;
  });
};

const getRiskKey = (risk) => {
  const key = normalizeRisk(risk);
  if (key === "high" || key === "medium" || key === "low") return key;
  return "unmapped";
};

const normalizeTextToken = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const resolveCertBucket = (empresa, certificadoIndex) => {
  const situacao = resolveEmpresaCertificadoSituacao(empresa, certificadoIndex);
  const key = normalizeTextToken(categorizeCertificadoSituacao(situacao) || situacao || empresa?.certificado);
  if (!key || key === "nao_possui") return "sem_certificado";
  if (key.includes("vencid")) return "vencido";
  if (key.includes("vence") || key.includes("alert")) return "vencendo";
  if (key.includes("valid") || key.includes("ok")) return "valido";
  return "sem_certificado";
};

export default function useCompanyRows({
  filteredEmpresas,
  extractEmpresaId,
  licencasByEmpresa,
  processosByEmpresa,
  taxasByEmpresa,
  certificadoIndex,
}) {
  return React.useMemo(() => {
    return filteredEmpresas.map((empresa, index) => {
      const empresaId = resolveEmpresaIdValue(empresa, extractEmpresaId);
      const document = companyDocumentValue(empresa);
      const documentDigits = companyDocumentDigits(empresa);
      const lics = findListByEmpresa(licencasByEmpresa, empresaId, document);
      const processos = findListByEmpresa(processosByEmpresa, empresaId, document);
      const taxa = findTaxaByEmpresa(taxasByEmpresa, empresaId, document);
      const ativos = processos.filter((proc) => !isProcessStatusInactive(proc.status));
      const licSummary = lics.reduce((acc, lic) => {
        if (!hasRelevantStatus(lic.status)) return acc;
        const key = getStatusKey(lic.status);
        acc.total += 1;
        if (key.includes("vencid")) acc.vencidas += 1;
        else if (key.includes("vence")) acc.vencendo += 1;
        else acc.ativas += 1;
        return acc;
      }, { total: 0, ativas: 0, vencendo: 0, vencidas: 0 });
      const taxaPendencias = taxa ? TAXA_TYPE_KEYS.filter((key) => isAlertStatus(taxa?.[key])).length : 0;
      const certificadoValido = hasValidCertificado(empresa, certificadoIndex);
      const usefulCnaes = getUsefulCnaes(empresa);
      const riscoConsolidado = getRiskKey(empresa?.risco_consolidado ?? empresa?.riscoConsolidado);
      const scoreUrgenciaRaw = empresa?.score_urgencia ?? empresa?.scoreUrgencia;
      const scoreUrgencia = Number.isFinite(Number(scoreUrgenciaRaw))
        ? Math.max(0, Math.min(100, Number(scoreUrgenciaRaw)))
        : null;
      const scoreStatus = String(empresa?.score_status ?? empresa?.scoreStatus ?? "").trim().toUpperCase() || null;
      const isCpfCompany = Boolean(empresa?.company_cpf) && !Boolean(empresa?.cnpj);
      const rowKey = [
        String(empresaId ?? "").trim() || "sem_id",
        documentDigits || "sem_doc",
        String(empresa?.razao_social ?? empresa?.empresa ?? empresa?.nome_fantasia ?? "").trim().toLowerCase() || "sem_nome",
        String(index),
      ].join("::");

      return {
        rowKey,
        empresa,
        empresaId: empresaId ? String(empresaId) : undefined,
        lics,
        licSummary,
        processos,
        ativos,
        taxaPendencias,
        scoreUrgencia,
        riscoConsolidado,
        scoreStatus,
        isCpfCompany,
        hasUsefulCnae: usefulCnaes.length > 0,
        certificadoValido,
        certBucket: resolveCertBucket(empresa, certificadoIndex),
        municipioNormalized: formatMunicipioDisplay(empresa?.municipio) || "-",
        porte: String(empresa?.porte || "").trim() || "-",
        responsavelFiscal: String(empresa?.responsavel_fiscal ?? empresa?.responsavelFiscal ?? "").trim(),
        flags: {
          debitos: hasDebito(taxa),
          semCertificado: !certificadoValido,
          taxasPendentes: taxaPendencias > 0,
          licencasVencendo: licSummary.vencendo > 0 || licSummary.vencidas > 0,
          processosAndamento: ativos.length > 0,
          criticos7dias: critico7dias(lics),
        },
      };
    });
  }, [certificadoIndex, extractEmpresaId, filteredEmpresas, licencasByEmpresa, processosByEmpresa, taxasByEmpresa]);
}
