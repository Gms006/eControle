import React from "react";

export default function useLicenceRows({
  base,
  empresas,
  normalizeDigits,
  normalizeTipo,
  parseStatusParts,
  parseDias,
  toCanonicalStatusKey,
  normalizeScoreRisk,
  normalizeScoreStatus,
  parseIsActiveFlag,
  resolveCompanyCertBucket,
  normalizeSanitaryComplexity,
  displayEmpresa,
  toBrDate,
  classify,
}) {
  return React.useMemo(
    () =>
      base.map((item) => {
        const companyId = String(item?.company_id || item?.empresa_id || "").trim();
        const companyById =
          companyId && Array.isArray(empresas)
            ? empresas.find((company) => String(company?.id || company?.company_id || "").trim() === companyId)
            : undefined;
        const itemCnpj = normalizeDigits(item?.cnpj || item?.company_cnpj);
        const companyByCnpj =
          !companyById && itemCnpj && Array.isArray(empresas)
            ? empresas.find((company) => normalizeDigits(company?.cnpj) === itemCnpj)
            : undefined;
        const companySnapshot = companyById || companyByCnpj;
        const tipoNorm = normalizeTipo(item?.tipo);
        const parsedStatus = parseStatusParts(item);
        const diasParaVencer = parseDias(item);
        const statusKeyCanonical = item?.status_key_canonical || toCanonicalStatusKey(parsedStatus.baseStatus);
        const scoreUrgenciaRaw = companySnapshot?.score_urgencia ?? companySnapshot?.scoreUrgencia;
        const scoreUrgencia = Number.isFinite(Number(scoreUrgenciaRaw))
          ? Math.max(0, Math.min(100, Number(scoreUrgenciaRaw)))
          : null;
        const scoreRisk = normalizeScoreRisk(
          companySnapshot?.risco_consolidado ?? companySnapshot?.riscoConsolidado,
        );
        const scoreStatus = normalizeScoreStatus(
          companySnapshot?.score_status ?? companySnapshot?.scoreStatus,
        );
        const companyActive = parseIsActiveFlag(companySnapshot);
        const certBucket = resolveCompanyCertBucket(companySnapshot?.certificado);
        const sanitaryComplexity = normalizeSanitaryComplexity(
          companySnapshot?.sanitary_complexity ?? companySnapshot?.sanitaryComplexity,
        );

        return {
          ...item,
          tipo_norm: tipoNorm,
          empresa_display: displayEmpresa(item),
          status_key: statusKeyCanonical,
          status_key_canonical: statusKeyCanonical,
          sem_vinculo: Boolean(item?.sem_vinculo) || !item?.empresa,
          status_label: parsedStatus.baseStatus,
          validade_br_display: toBrDate(item?.valid_until) || parsedStatus.validadeBr,
          validade_iso_display: item?.valid_until || parsedStatus.validadeIso,
          criticidade: classify(item),
          dias_para_vencer: Number.isFinite(diasParaVencer) ? diasParaVencer : null,
          score_urgencia: scoreUrgencia,
          risco_consolidado: scoreRisk || null,
          score_status: scoreStatus || null,
          risk_bucket: scoreRisk === "HIGH" || scoreRisk === "MEDIUM" || scoreRisk === "LOW" ? scoreRisk : "UNMAPPED",
          cert_bucket: certBucket,
          company_active: companyActive,
          sanitary_complexity: sanitaryComplexity || null,
        };
      }),
    [
      base,
      empresas,
      normalizeDigits,
      normalizeTipo,
      parseStatusParts,
      parseDias,
      toCanonicalStatusKey,
      normalizeScoreRisk,
      normalizeScoreStatus,
      parseIsActiveFlag,
      resolveCompanyCertBucket,
      normalizeSanitaryComplexity,
      displayEmpresa,
      toBrDate,
      classify,
    ],
  );
}
