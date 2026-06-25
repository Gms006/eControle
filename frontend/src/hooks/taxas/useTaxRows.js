import React from "react";
import { TAXA_SEARCH_KEYS } from "@/lib/constants";

export default function useTaxRows({
  taxas,
  matchesMunicipioFilter,
  matchesQuery,
  resolveCompany,
  certificadoIndex,
  resolveEmpresaCertificadoSituacao,
  getCompanyStatusKey,
  getCompanyRiskKey,
  getCertBucketKey,
  getCompanyUrgencyScore,
  hasCompanyAlert,
}) {
  return React.useMemo(
    () =>
      taxas
        .filter((taxa) => {
          if (!matchesMunicipioFilter(taxa)) return false;
          const camposPesquisa = [taxa.empresa, taxa.cnpj, ...TAXA_SEARCH_KEYS.map((key) => taxa?.[key])];
          return matchesQuery(camposPesquisa, {
            nome: [taxa.empresa],
            razao: [taxa.empresa],
            cnpj: [taxa.cnpj],
          });
        })
        .map((taxa) => {
          const company = resolveCompany(taxa);
          const certificadoSituacao = company ? resolveEmpresaCertificadoSituacao(company, certificadoIndex) : "";
          return {
            ...taxa,
            __company: company,
            __companyStatusKey: getCompanyStatusKey(company),
            __riskKey: getCompanyRiskKey(company),
            __certBucket: getCertBucketKey(certificadoSituacao || company?.certificado),
            __certificadoSituacao: certificadoSituacao || company?.certificado || "",
            __urgencyScore: getCompanyUrgencyScore(company, hasCompanyAlert),
          };
        }),
    [
      certificadoIndex,
      getCertBucketKey,
      getCompanyRiskKey,
      getCompanyStatusKey,
      getCompanyUrgencyScore,
      hasCompanyAlert,
      matchesMunicipioFilter,
      matchesQuery,
      resolveCompany,
      resolveEmpresaCertificadoSituacao,
      taxas,
    ],
  );
}
