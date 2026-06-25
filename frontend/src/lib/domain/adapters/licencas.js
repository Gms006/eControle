import { enrichWithCompany } from "@/lib/domain/indexes/companyIndex";

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== "";

const LICENSE_FIELD_MAP = [
  { field: "alvara_vig_sanitaria", tipo: "Sanitária" },
  { field: "cercon", tipo: "CERCON" },
  { field: "alvara_funcionamento", tipo: "Funcionamento" },
  { field: "certidao_uso_solo", tipo: "Uso do Solo" },
  { field: "licenca_ambiental", tipo: "Ambiental" },
];

export const adaptLicencasRecords = (licencas, indexes) => {
  const expanded = [];

  licencas.forEach((lic) => {
    const enriched = enrichWithCompany(lic, indexes);

    if (hasValue(lic?.tipo) || hasValue(lic?.status) || hasValue(lic?.validade)) {
      expanded.push({
        ...enriched,
        licence_id: lic?.licence_id ?? lic?.id,
        licence_field:
          lic?.licence_field ??
          LICENSE_FIELD_MAP.find((entry) => entry.tipo.toLowerCase() === String(lic?.tipo || "").toLowerCase())?.field,
        status_geral: lic?.status_geral ?? lic?.statusGeral,
        motivo_nao_exigido: lic?.motivo_nao_exigido ?? lic?.raw?.motivo_nao_exigido,
        justificativa_nao_exigido: lic?.justificativa_nao_exigido ?? lic?.raw?.justificativa_nao_exigido,
        valid_until: lic?.valid_until ?? lic?.validade ?? null,
        company_name: lic?.company_name,
      });
      return;
    }

    LICENSE_FIELD_MAP.forEach(({ field, tipo }) => {
      const status = lic?.[field];
      const normalizedStatus = hasValue(status) ? status : "nao_possui";
      const sourceRaw = lic?.raw && typeof lic.raw === "object" ? lic.raw : {};
      const validUntilRaw = lic?.[`${field}_valid_until`] ?? sourceRaw?.[`${field}_valid_until`] ?? null;
      const validadeRaw = lic?.[`validade_${field}`] ?? sourceRaw?.[`validade_${field}`] ?? sourceRaw?.[`${field}_validade`] ?? null;

      expanded.push({
        ...enriched,
        id: `${lic?.id ?? enriched?.empresa_id ?? "lic"}:${field}`,
        licence_id: lic?.id,
        licence_field: field,
        tipo,
        status: normalizedStatus,
        status_geral: lic?.status_geral ?? lic?.statusGeral ?? null,
        valid_until: validUntilRaw,
        validade: validadeRaw,
        validade_br:
          lic?.[`validade_${field}_br`] ??
          sourceRaw?.[`validade_${field}_br`] ??
          (typeof validadeRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(validadeRaw)
            ? `${validadeRaw.slice(8, 10)}/${validadeRaw.slice(5, 7)}/${validadeRaw.slice(0, 4)}`
            : null) ??
          null,
        status_detalhe: sourceRaw?.[`${field}_detalhe`] ?? null,
        motivo_nao_exigido: sourceRaw?.[`${field}_motivo_nao_exigido`] ?? lic?.motivo_nao_exigido ?? null,
        justificativa_nao_exigido: sourceRaw?.[`${field}_justificativa_nao_exigido`] ?? lic?.justificativa_nao_exigido ?? null,
        observacao: sourceRaw?.[`${field}_observacao`] ?? null,
        responsavel: sourceRaw?.[`${field}_responsavel`] ?? null,
        proxima_acao: sourceRaw?.[`${field}_proxima_acao`] ?? null,
        company_name: lic?.company_name,
        company_razao_social: lic?.company_razao_social,
        company_cnpj: lic?.company_cnpj,
      });
    });
  });

  return expanded;
};
