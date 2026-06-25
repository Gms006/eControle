import { formatMunicipioDisplay } from "@/lib/normalization";
import { normalizeEmpresaRecord } from "@/lib/domain/adapters/empresas";

export const normalizeCnpjDigits = (value) => String(value ?? "").replace(/\D/g, "");

export const getEmpresaKey = (item) => {
  const candidate = item?.empresa_id ?? item?.empresaId ?? item?.company_id ?? item?.companyId ?? item?.id;
  if (candidate === undefined || candidate === null) return undefined;
  const key = String(candidate).trim();
  return key || undefined;
};

export const getLinkedCompanyId = (item) => {
  const candidate = item?.empresa_id ?? item?.empresaId ?? item?.company_id ?? item?.companyId;
  if (candidate === undefined || candidate === null) return undefined;
  const key = String(candidate).trim();
  return key || undefined;
};

export const toCompanyIdKey = (item) => getLinkedCompanyId(item) ?? getEmpresaKey(item);

export const buildCompanyIndex = (empresas) => {
  const byId = new Map();
  const byCnpj = new Map();

  empresas.forEach((empresa) => {
    const normalized = normalizeEmpresaRecord(empresa, { getEmpresaKey });
    const key = getEmpresaKey(normalized);
    if (key) byId.set(key, normalized);
    const cnpjDigits = normalizeCnpjDigits(normalized?.cnpj);
    if (cnpjDigits) byCnpj.set(cnpjDigits, normalized);
  });

  return { byId, byCnpj };
};

export const getCompanyFromIndexes = (item, indexes) => {
  const key = getEmpresaKey(item);
  if (key && indexes.byId.has(key)) return indexes.byId.get(key);
  const raw = item?.raw && typeof item.raw === "object" ? item.raw : {};
  const cnpjDigits = normalizeCnpjDigits(
    item?.cnpj ??
      item?.cnpj_empresa ??
      item?.cnpjEmpresa ??
      item?.company_cnpj ??
      raw?.company_cnpj ??
      raw?.cnpj,
  );
  if (cnpjDigits && indexes.byCnpj.has(cnpjDigits)) return indexes.byCnpj.get(cnpjDigits);
  return undefined;
};

export const hasCompanyReference = (item) =>
  Boolean(
    item?.company_id ??
      item?.companyId ??
      item?.empresa_id ??
      item?.empresaId ??
      item?.cnpj ??
      item?.cnpj_empresa ??
      item?.cnpjEmpresa ??
      item?.company_cnpj,
  );

export const hasActiveCompanyLink = (item, indexes) => {
  const raw = item?.raw && typeof item.raw === "object" ? item.raw : {};
  const company = getCompanyFromIndexes(item, indexes);
  if (company) return true;
  const companyId = item?.company_id ?? item?.companyId ?? item?.empresa_id ?? item?.empresaId;
  if (companyId !== undefined && companyId !== null) return indexes.byId.has(String(companyId).trim());
  const cnpjDigits = normalizeCnpjDigits(
    item?.cnpj ??
      item?.cnpj_empresa ??
      item?.cnpjEmpresa ??
      item?.company_cnpj ??
      raw?.company_cnpj ??
      raw?.cnpj,
  );
  if (cnpjDigits) return indexes.byCnpj.has(cnpjDigits);
  return Boolean(companyId || cnpjDigits || item?.empresa || item?.cnpj || raw?.company_razao_social);
};

export const enrichWithCompany = (item, indexes) => {
  const raw = item?.raw && typeof item.raw === "object" ? item.raw : {};
  const company = getCompanyFromIndexes(item, indexes);
  const itemCompanyId = getLinkedCompanyId(item);
  const empresaId = itemCompanyId ?? getEmpresaKey(company);
  const fallbackEmpresa =
    item?.company_name ??
    item?.company_razao_social ??
    raw?.company_name ??
    raw?.company_razao_social ??
    item?.empresa ??
    item?.razao_social ??
    raw?.empresa ??
    raw?.razao_social;
  const empresaNome =
    fallbackEmpresa ??
    company?.empresa ??
    company?.razao_social ??
    (empresaId ? `Empresa não vinculada (ID ${empresaId})` : "Empresa não vinculada");
  const semVinculo = Boolean(item?.sem_vinculo) || (!company && !itemCompanyId);

  return {
    ...item,
    ...(empresaId
      ? {
          empresa_id: empresaId,
          company_id: item?.company_id ?? item?.empresa_id ?? item?.companyId ?? item?.empresaId ?? empresaId,
        }
      : {}),
    empresa: empresaNome,
    cnpj:
      item?.cnpj ??
      item?.cnpj_empresa ??
      item?.cnpjEmpresa ??
      item?.company_cnpj ??
      raw?.company_cnpj ??
      raw?.cnpj ??
      company?.cnpj,
    municipio: formatMunicipioDisplay(item?.municipio ?? company?.municipio),
    sem_vinculo: semVinculo,
  };
};

export const groupByCompanyId = (items, getCompanyId = toCompanyIdKey) => {
  const map = new Map();
  if (!Array.isArray(items)) return map;
  items.forEach((item) => {
    const companyId = getCompanyId(item);
    if (companyId === undefined) return;
    const list = map.get(companyId) || [];
    list.push(item);
    map.set(companyId, list);
  });
  return map;
};

export const mapByCompanyId = (items, getCompanyId = toCompanyIdKey) => {
  const map = new Map();
  if (!Array.isArray(items)) return map;
  items.forEach((item) => {
    const companyId = getCompanyId(item);
    if (companyId === undefined) return;
    map.set(companyId, item);
  });
  return map;
};
