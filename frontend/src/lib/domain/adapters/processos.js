import dayjs from "dayjs";
import { formatMunicipioDisplay } from "@/lib/normalization";
import { normalizeText, removeDiacritics } from "@/lib/text";
import { categorizeCertificadoSituacao } from "@/lib/certificados";
import { getProcessBaseType, normalizeProcessType } from "@/lib/process";
import { enrichWithCompany, getEmpresaKey, normalizeCnpjDigits } from "@/lib/domain/indexes/companyIndex";

const PROCESS_TYPE_DISPLAY = {
  BOMBEIROS: "CERCON",
  FUNCIONAMENTO: "Funcionamento",
  DIVERSOS: "Diversos",
  USO_DO_SOLO: "Uso do Solo",
  SANITARIO: "Sanitário",
  ALVARA_SANITARIO: "Alvará Sanitário",
};

export const normalizeTipoKey = (tipoBase) =>
  removeDiacritics(normalizeText(tipoBase ?? ""))
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

const normalizeKey = (value) =>
  removeDiacritics(String(value ?? "").toLowerCase()).replace(/\s+/g, "_").trim();

const parseCompanyIsActive = (value) => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const normalized = normalizeKey(value);
    if (["true", "1", "ativo", "ativa"].includes(normalized)) return true;
    if (["false", "0", "inativo", "inativa"].includes(normalized)) return false;
  }
  return null;
};

export const getCompanyStatusKey = (empresa) => {
  const isActive = parseCompanyIsActive(
    empresa?.is_active ??
      empresa?.isActive ??
      empresa?.status_empresas ??
      empresa?.statusEmpresa ??
      empresa?.status_empresa ??
      empresa?.status,
  );
  if (isActive === true) return "Ativas";
  if (isActive === false) return "Inativas";
  return "Todas";
};

export const getCompanyRiskKey = (empresa) => {
  const key = normalizeKey(empresa?.risco_consolidado ?? empresa?.riscoConsolidado ?? empresa?.score_status ?? empresa?.scoreStatus);
  if (key.includes("high") || key.includes("alto")) return "high";
  if (key.includes("medium") || key.includes("medio")) return "medium";
  if (key.includes("low") || key.includes("baixo")) return "low";
  return "unmapped";
};

export const getCertBucketKey = (situacao) => {
  const category = categorizeCertificadoSituacao(situacao);
  if (category.includes("VÁLIDO")) return "valido";
  if (category.includes("VENCE DENTRO")) return "vencendo";
  if (category.includes("VENCIDO")) return "vencido";
  return "sem_certificado";
};

const extractDateValue = (value) => {
  const normalized = normalizeText(value).trim();
  if (!normalized) return null;

  // Deterministic parser for PT-BR date strings with optional time.
  const ptMatch = normalized.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (ptMatch) {
    const [, dd, mm, yyyy, hh = "00", min = "00", ss = "00"] = ptMatch;
    const isoCandidate = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
    const parsedPt = dayjs(isoCandidate);
    if (parsedPt.isValid()) return parsedPt.valueOf();
  }

  const isoDateMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    const parsedIsoDate = dayjs(`${normalized}T00:00:00`);
    if (parsedIsoDate.isValid()) return parsedIsoDate.valueOf();
  }

  const fallback = dayjs(normalized);
  return fallback.isValid() ? fallback.valueOf() : null;
};

export const compareProcessos = (a, b, field, direction, meta = {}) => {
  const dir = direction === "desc" ? -1 : 1;
  if (meta.isDate) {
    const aValue = extractDateValue(a?.[field]);
    const bValue = extractDateValue(b?.[field]);
    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    return (aValue - bValue) * dir;
  }
  if (meta.isNumber) {
    const aValue = Number(a?.[field] ?? 0);
    const bValue = Number(b?.[field] ?? 0);
    return (aValue - bValue) * dir;
  }
  const aText = normalizeText(a?.[field] ?? "").trim();
  const bText = normalizeText(b?.[field] ?? "").trim();
  if (!aText && !bText) return 0;
  if (!aText) return 1;
  if (!bText) return -1;
  return aText.localeCompare(bText, "pt-BR", { sensitivity: "base" }) * dir;
};

export const resolveProcessId = (proc) =>
  normalizeText(proc?.id ?? proc?.process_id ?? proc?.processId ?? proc?.processo_id).trim();

export const formatMunicipio = (proc) => formatMunicipioDisplay(proc?.municipio_exibicao || proc?.municipio);

export const getTipoDisplay = (tipoBase) => {
  const key = normalizeTipoKey(tipoBase);
  return PROCESS_TYPE_DISPLAY[key] ?? tipoBase ?? "Processo";
};

export const resolveTipoFromProcess = (proc) => {
  const tipoNormalizado = normalizeProcessType(proc);
  const tipoBase = getProcessBaseType(tipoNormalizado);
  return { tipoBase, tipoKey: normalizeTipoKey(tipoBase), tipoDisplay: getTipoDisplay(tipoBase) };
};

export const getProcessKey = (proc, index) => {
  const tipoKey = proc?.tipoKey || normalizeTipoKey(proc?.tipo);
  const parts = [proc?.id, proc?.protocolo, proc?.cnpj, proc?.empresa]
    .map((value) => normalizeText(value).trim())
    .filter(Boolean);
  const suffix = parts.length > 0 ? parts.join("-") : String(index);
  return [tipoKey, suffix].filter(Boolean).join("-");
};

export const normalizeStatusKey = (value) =>
  removeDiacritics(normalizeText(value ?? "").toLowerCase()).trim();

const EXCLUDED_URGENT_STATUS_KEYWORDS = [
  "concluido",
  "licenciado",
  "indeferido",
  "cancelado",
];

export const isUrgentByStatus = (proc) => {
  const statusKey = removeDiacritics(
    normalizeText(proc?.situacao || proc?.status || "").toLowerCase(),
  ).trim();
  if (!statusKey) return true;
  return !EXCLUDED_URGENT_STATUS_KEYWORDS.some((keyword) => statusKey.includes(keyword));
};

/** @param {any} processo */
export const normalizeProcesso = (processo) => {
  const item = processo && typeof processo === "object" ? processo : {};
  const extra = item?.extra && typeof item.extra === "object" ? item.extra : {};
  const raw = item?.raw && typeof item.raw === "object" ? item.raw : {};
  const status = item?.status ?? item?.situacao ?? item?.status_padrao ?? "";
  return {
    ...item,
    id: item?.id ?? item?.process_id ?? item?.processo_id,
    process_id: item?.process_id ?? item?.processo_id ?? item?.id,
    processo_id: item?.processo_id ?? item?.process_id ?? item?.id,
    empresa_id: item?.empresa_id ?? item?.company_id ?? item?.empresaId ?? item?.companyId,
    company_id: item?.company_id ?? item?.empresa_id ?? item?.companyId ?? item?.empresaId,
    company_razao_social:
      item?.company_razao_social ??
      item?.company_razaoSocial ??
      raw?.company_razao_social ??
      raw?.company_razaoSocial ??
      extra?.company_razao_social ??
      extra?.company_razaoSocial,
    company_cnpj:
      item?.company_cnpj ??
      raw?.company_cnpj ??
      extra?.company_cnpj,
    tipo:
      item?.tipo ??
      item?.tipo_processo ??
      item?.tipoProcesso ??
      item?.process_type ??
      item?.processType,
    status,
    situacao: item?.situacao ?? status,
    operacao:
      item?.operacao ??
      extra?.operacao ??
      raw?.operacao ??
      item?.operation ??
      extra?.operation ??
      raw?.operation ??
      "",
    orgao:
      item?.orgao ??
      extra?.orgao ??
      raw?.orgao ??
      "",
    obs: item?.obs ?? item?.observacao ?? item?.observacoes ?? "",
    municipio: formatMunicipioDisplay(item?.municipio ?? item?.municipio_exibicao),
  };
};

/** @param {any[]} records @param {{byId: Map<string, any>, byCnpj: Map<string, any>}} companyIndexes @param {Map<string, any>} taxasByCompanyId @param {Map<string, any>} taxasByCnpj */
export const adaptProcessosRecords = (records, companyIndexes, taxasByCompanyId = new Map(), taxasByCnpj = new Map()) => {
  if (!Array.isArray(records)) return [];
  return records.map((raw) => {
    const linked = enrichWithCompany(raw, companyIndexes);
    const companyId = getEmpresaKey(linked);
    const cnpjDigits = normalizeCnpjDigits(linked?.cnpj);
    const taxa =
      (companyId && taxasByCompanyId.get(companyId)) ||
      (cnpjDigits && taxasByCnpj.get(cnpjDigits)) ||
      null;
    return normalizeProcesso({
      ...linked,
      tpi_sync_status: linked?.tpi_sync_status ?? taxa?.tpi_sync_status,
      taxa_bombeiros_sync_status: linked?.taxa_bombeiros_sync_status ?? taxa?.taxa_bombeiros_sync_status,
      taxa_sanitaria_sync_status: linked?.taxa_sanitaria_sync_status ?? taxa?.taxa_sanitaria_sync_status,
      alvara_sanitario_status: linked?.alvara_sanitario_status ?? taxa?.alvara_sanitario_status,
    });
  });
};

