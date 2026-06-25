import { enrichWithCompany } from "@/lib/domain/indexes/companyIndex";

export const adaptTaxasRecords = (taxas, indexes) =>
  taxas.map((taxa) => {
    const enriched = enrichWithCompany(taxa, indexes);
    return {
      ...enriched,
      func: taxa?.func ?? taxa?.taxa_funcionamento,
      publicidade: taxa?.publicidade ?? taxa?.taxa_publicidade,
      sanitaria: taxa?.sanitaria ?? taxa?.taxa_vig_sanitaria,
      localizacao_instalacao: taxa?.localizacao_instalacao ?? taxa?.taxa_localiz_instalacao,
      area_publica: taxa?.area_publica ?? taxa?.taxa_ocup_area_publica,
      bombeiros: taxa?.bombeiros ?? taxa?.taxa_bombeiros,
      status_geral: taxa?.status_geral ?? taxa?.status_taxas,
    };
  });
