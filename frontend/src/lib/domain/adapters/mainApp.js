import { formatMunicipioDisplay } from "@/lib/normalization";

export const getEmpresaKeyFromRecord = (item) => {
  const candidate =
    item?.empresa_id ??
    item?.empresaId ??
    item?.company_id ??
    item?.companyId ??
    item?.id;
  if (candidate === undefined || candidate === null) return undefined;
  const key = String(candidate).trim();
  return key || undefined;
};

export const dedupeEmpresas = (
  empresasRaw,
  { normalizeEmpresaRecord, normalizeCnpjDigits },
) =>
  Array.from(
    (Array.isArray(empresasRaw) ? empresasRaw : [])
      .map((empresa) => normalizeEmpresaRecord(empresa, { getEmpresaKey: getEmpresaKeyFromRecord }))
      .reduce((acc, empresa) => {
        const key =
          String(
            empresa?.empresa_id ??
              empresa?.id ??
              empresa?.company_id ??
              normalizeCnpjDigits(empresa?.cnpj) ??
              Math.random(),
          ).trim() || Math.random().toString(36);
        if (!acc.has(key)) acc.set(key, empresa);
        return acc;
      }, new Map())
      .values(),
  );

export const buildTaxaLookupMaps = (taxasAdaptadas, normalizeCnpjDigits) => {
  const taxasByCompanyId = new Map();
  const taxasByCnpj = new Map();

  (Array.isArray(taxasAdaptadas) ? taxasAdaptadas : []).forEach((taxa) => {
    const companyKey = String(
      taxa?.company_id ?? taxa?.empresa_id ?? taxa?.companyId ?? taxa?.empresaId ?? "",
    ).trim();
    if (companyKey) {
      taxasByCompanyId.set(companyKey, taxa);
    }

    const cnpjDigits = normalizeCnpjDigits(
      taxa?.cnpj ?? taxa?.cnpj_empresa ?? taxa?.cnpjEmpresa,
    );
    if (cnpjDigits) {
      taxasByCnpj.set(cnpjDigits, taxa);
    }
  });

  return { taxasByCompanyId, taxasByCnpj };
};

export const pickMunicipioValue = (item) =>
  item?.municipio ??
  item?.municipio_exibicao ??
  item?.municipioExibicao ??
  item?.municipio_nome ??
  item?.municipioNome;

export const buildMunicipioOptions = ({
  municipiosApi,
  empresas,
  licencas,
  taxas,
  processos,
}) => {
  if (Array.isArray(municipiosApi) && municipiosApi.length > 0) {
    const list = Array.from(
      new Set(
        municipiosApi
          .filter(Boolean)
          .map((value) => formatMunicipioDisplay(value))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return ["Todos", ...list];
  }

  const entries = new Set();
  [empresas, licencas, taxas, processos].forEach((collection) => {
    (Array.isArray(collection) ? collection : []).forEach((item) => {
      const value = pickMunicipioValue(item);
      if (!value) return;
      const normalized = formatMunicipioDisplay(value);
      if (normalized) {
        entries.add(normalized);
      }
    });
  });

  return ["Todos", ...Array.from(entries).filter(Boolean).sort((a, b) => a.localeCompare(b))];
};
