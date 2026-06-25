import React from "react";

const resolveDiversosOperacao = (proc) => {
  const direct = String(proc?.operacao ?? "").trim();
  if (direct) return direct;

  const tipoRaw = String(
    proc?.tipo ??
      proc?.tipo_processo ??
      proc?.tipoProcesso ??
      proc?.process_type ??
      proc?.processType ??
      "",
  ).trim();
  if (!tipoRaw) return "";
  if (!/^diversos\b/i.test(tipoRaw)) return "";

  const separated =
    tipoRaw.split(/\s[-–—:]\s/)[1] ||
    tipoRaw.split("-")[1] ||
    "";
  return String(separated).trim();
};

export default function useProcessRows({
  processosVisiveis,
  resolveTipoFromProcess,
  getDiversosOperacaoLabel,
  companyIndex,
  getCompanyStatusKey,
  getCompanyRiskKey,
  resolveEmpresaCertificadoSituacao,
  certificadoIndex,
  getCertBucketKey,
  getProcessUrgency,
}) {
  return React.useMemo(() => {
    return processosVisiveis.map((proc) => {
      const { tipoBase, tipoKey, tipoDisplay } = resolveTipoFromProcess(proc);
      const diversosOperacaoLabel =
        tipoBase === "Diversos"
          ? getDiversosOperacaoLabel(resolveDiversosOperacao(proc))
          : undefined;
      const companyId = String(proc?.empresa_id ?? proc?.empresaId ?? proc?.company_id ?? proc?.companyId ?? "").trim();
      const cnpjKey = String(proc?.cnpj ?? "").replace(/\D/g, "").trim();
      const company =
        (companyId && companyIndex.byId.get(companyId)) ||
        (cnpjKey && companyIndex.byCnpj.get(cnpjKey)) ||
        null;
      const isSemVinculo = Boolean(proc?.sem_vinculo) || (!company && !companyId);
      const companyStatus = isSemVinculo ? "Sem vínculo" : getCompanyStatusKey(company);
      const companyRisk = getCompanyRiskKey(company);
      const certSituacao = company ? resolveEmpresaCertificadoSituacao(company, certificadoIndex) : company?.certificado;
      const certBucket = getCertBucketKey(certSituacao || company?.certificado);
      const merged = {
        ...proc,
        tipoBase,
        tipoKey,
        tipoDisplay,
        diversosOperacaoLabel,
        company,
        companyStatus,
        companyRisk,
        certBucket,
      };
      const urgency = getProcessUrgency(merged);
      const rawScore = urgency.score;
      return {
        ...merged,
        urgencyScore: Number.isFinite(rawScore)
          ? Math.max(0, Math.min(100, rawScore))
          : rawScore,
        urgencyScoreRaw: rawScore,
        urgencyBuckets: urgency.buckets,
        urgencyMeta: urgency,
      };
    });
  }, [
    certificadoIndex,
    companyIndex.byCnpj,
    companyIndex.byId,
    getCertBucketKey,
    getCompanyRiskKey,
    getCompanyStatusKey,
    getDiversosOperacaoLabel,
    getProcessUrgency,
    processosVisiveis,
    resolveEmpresaCertificadoSituacao,
    resolveTipoFromProcess,
  ]);
}
