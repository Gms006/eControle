import { getStatusKey } from "@/lib/status";
import { parsePtDate } from "@/lib/text";

const DEFAULT_API_BASE = "http://localhost:8000";

export const normalizeApiBase = (rawBase) => {
  const trimmed = (rawBase ?? "").trim();
  if (trimmed) {
    return trimmed.replace(/\/+$/u, "");
  }
  return DEFAULT_API_BASE;
};

const API_BASE_URL = normalizeApiBase(
  import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL,
);

const LEGACY_ENDPOINT_MAP = {
  "/empresas": "/api/v1/empresas",
  "/kpis": "/api/v1/grupos/kpis",
  "/alertas": "/api/v1/alertas",
  "/licencas": "/api/v1/licencas",
  "/processos": "/api/v1/processos",
  "/taxas": "/api/v1/taxas",
  "/municipios": "/api/v1/municipios",
  "/uteis": "/api/v1/uteis",
  "/certificados": "/api/v1/certificados",
  "/agendamentos": "/api/v1/agendamentos",
};

const CANONICAL_ENDPOINT_MAP = {
  "/empresas": "/empresas",
  "/api/v1/empresas": "/empresas",
  "/kpis": "/kpis",
  "/api/v1/grupos/kpis": "/kpis",
  "/alertas": "/alertas",
  "/api/v1/alertas": "/alertas",
  "/licencas": "/licencas",
  "/api/v1/licencas": "/licencas",
  "/processos": "/processos",
  "/api/v1/processos": "/processos",
  "/taxas": "/taxas",
  "/api/v1/taxas": "/taxas",
  "/municipios": "/municipios",
  "/api/v1/municipios": "/municipios",
  "/uteis": "/uteis",
  "/api/v1/uteis": "/uteis",
  "/certificados": "/certificados",
  "/api/v1/certificados": "/certificados",
  "/agendamentos": "/agendamentos",
  "/api/v1/agendamentos": "/agendamentos",
};

const ensureLeadingSlash = (path = "") => (path.startsWith("/") ? path : `/${path}`);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "string") {
    const ptDate = parsePtDate(value);
    if (ptDate instanceof Date && !Number.isNaN(ptDate.getTime())) {
      return ptDate;
    }
    const isoCandidate = new Date(value);
    if (!Number.isNaN(isoCandidate.getTime())) {
      return isoCandidate;
    }
  }
  return null;
};

const computeDiasRestantes = (dateValue) => {
  const target = parseDateValue(dateValue);
  if (!(target instanceof Date)) {
    return null;
  }
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffMs = end.getTime() - start.getTime();
  return Math.trunc(diffMs / MS_PER_DAY);
};

const toFiniteNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const NOME_PREPOSICOES = ["da", "de", "do", "das", "dos", "e"];

export const normalizeNomePessoa = (nome) => {
  if (!nome || typeof nome !== "string") return nome;

  const trimmed = nome.trim();
  if (!trimmed) return trimmed;

  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      // preposições / conjunções no meio do nome ficam minúsculas
      if (index > 0 && NOME_PREPOSICOES.includes(word)) {
        return word;
      }
      // capitaliza primeira letra, resto minúsculo
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};

const getCanonicalKey = (path = "") => {
  const normalizedPath = ensureLeadingSlash(path);
  const resolved = CANONICAL_ENDPOINT_MAP[normalizedPath];
  if (resolved) {
    return resolved;
  }
  const mapped = LEGACY_ENDPOINT_MAP[normalizedPath];
  if (mapped) {
    return CANONICAL_ENDPOINT_MAP[mapped] ?? mapped;
  }
  return normalizedPath;
};

const resolveEndpointPath = (path = "") => {
  const normalizedPath = ensureLeadingSlash(path);
  if (/^https?:/i.test(normalizedPath)) {
    return normalizedPath;
  }
  if (normalizedPath.startsWith("/api/")) {
    return normalizedPath;
  }
  const mapped = LEGACY_ENDPOINT_MAP[normalizedPath];
  if (mapped) {
    return mapped;
  }
  return `/api${normalizedPath}`;
};

const buildQueryString = (query) => {
  if (!query || typeof query !== "object") {
    return "";
  }
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry === undefined || entry === null) {
          return;
        }
        params.append(key, String(entry));
      });
      return;
    }
    const stringValue = String(value);
    if (stringValue.trim() === "") {
      return;
    }
    params.append(key, stringValue);
  });
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
};

const buildAbsoluteUrl = (endpointPath, query) => {
  const querySuffix = buildQueryString(query);
  if (/^https?:/i.test(endpointPath)) {
    const hasQuery = endpointPath.includes("?");
    if (!querySuffix) {
      return endpointPath;
    }
    return `${endpointPath}${hasQuery ? "&" : ""}${querySuffix.replace(/^\?/, hasQuery ? "" : "?")}`;
  }
  const base = API_BASE_URL.replace(/\/+$/u, "");
  const normalizedEndpoint = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  const url = `${base}${normalizedEndpoint}`;
  if (!querySuffix) {
    return url;
  }
  const hasQuery = url.includes("?");
  const suffix = querySuffix.replace(/^\?/, hasQuery ? "" : "?");
  return `${url}${hasQuery ? "&" : ""}${suffix}`;
};

const getAuthToken = () => {
  try {
    if (typeof window !== "undefined" && window?.localStorage) {
      const stored = window.localStorage.getItem("jwt");
      if (stored && stored.trim() !== "") {
        return stored.trim();
      }
    }
  } catch (error) {
    console.warn("[api] Falha ao acessar localStorage:", error);
  }
  const fallback = import.meta.env.VITE_DEV_TOKEN;
  if (typeof fallback === "string" && fallback.trim() !== "") {
    return fallback.trim();
  }
  return "";
};

const buildHeaders = (headers) => {
  const finalHeaders = new Headers(headers || {});
  if (!finalHeaders.has("Accept")) {
    finalHeaders.set("Accept", "application/json");
  }
  const token = getAuthToken();
  if (token && !finalHeaders.has("Authorization")) {
    finalHeaders.set("Authorization", `Bearer ${token}`);
  }
  return finalHeaders;
};

const attachPaginationInfo = (collection, meta) => {
  if (!collection || typeof collection !== "object") {
    return collection;
  }
  const define = (key, value) => {
    if (value === undefined) return;
    Object.defineProperty(collection, key, {
      value,
      enumerable: false,
      writable: false,
      configurable: true,
    });
  };
  define("total", meta.total);
  define("page", meta.page);
  define("size", meta.size);
  return collection;
};

export const normalizeEmpresaFromApi = (item) => {
  if (!item || typeof item !== "object") {
    return item;
  }
  const empresaIdCandidates = [item.empresa_id, item.empresaId, item.id];
  let resolvedId;
  for (const candidate of empresaIdCandidates) {
    const parsed = toFiniteNumber(candidate);
    if (parsed !== undefined) {
      resolvedId = parsed;
      break;
    }
  }
  const normalized = { ...item };
  if (resolvedId !== undefined) {
    normalized.empresa_id = resolvedId;
    if (!Object.prototype.hasOwnProperty.call(normalized, "empresaId")) {
      normalized.empresaId = resolvedId;
    }
    if (!Object.prototype.hasOwnProperty.call(normalized, "id")) {
      normalized.id = resolvedId;
    }
  }
  if (normalized.org_id !== undefined && normalized.org_id !== null) {
    normalized.org_id = String(normalized.org_id);
  }
  if (normalized.inscricao_municipal !== undefined && normalized.inscricaoMunicipal === undefined) {
    normalized.inscricaoMunicipal = normalized.inscricao_municipal;
  }
  if (normalized.inscricao_estadual !== undefined && normalized.inscricaoEstadual === undefined) {
    normalized.inscricaoEstadual = normalized.inscricao_estadual;
  }
  if (normalized.responsavel_legal !== undefined && normalized.responsavelLegal === undefined) {
    normalized.responsavelLegal = normalized.responsavel_legal;
  }
  if (
    normalized.cpf_responsavel_legal !== undefined &&
    normalized.cpfResponsavelLegal === undefined
  ) {
    normalized.cpfResponsavelLegal = normalized.cpf_responsavel_legal;
  }
  const responsavelFiscalRaw =
    normalized.responsavelFiscal ?? normalized.responsavel_fiscal;
  if (responsavelFiscalRaw !== undefined) {
    const responsavelFiscal = normalizeNomePessoa(responsavelFiscalRaw);
    normalized.responsavelFiscal = responsavelFiscal;
    normalized.responsavel_fiscal = responsavelFiscal;
  }
  return normalized;
};

export const normalizeAlertaFromApi = (item) => {
  if (!item || typeof item !== "object") {
    return item;
  }
  const normalized = { ...item };
  if (normalized.org_id !== undefined && normalized.org_id !== null) {
    normalized.org_id = String(normalized.org_id);
  }
  if (normalized.alerta_id === undefined && normalized.id !== undefined) {
    normalized.alerta_id = String(normalized.id);
  }
  const diasRestantes = toFiniteNumber(normalized.dias_restantes);
  if (diasRestantes !== undefined) {
    normalized.dias_restantes = diasRestantes;
  }
  return normalized;
};

export const normalizeLicencaFromApi = (item) => {
  if (!item || typeof item !== "object") return item;

  const normalized = { ...item };
  const validade =
    normalized.validade ??
    normalized.data_validade ??
    normalized.dataVencimento ??
    normalized.data_vencimento;

  const diasRestantes = computeDiasRestantes(validade);
  if (diasRestantes !== null) {
    normalized.diasRestantes = diasRestantes;
    normalized.dias_restantes = diasRestantes;

    const statusKey = getStatusKey(normalized.status);
    if (!statusKey || statusKey.includes("venc") || statusKey === "valido") {
      if (diasRestantes < 0) {
        normalized.status = "Vencido";
      } else if (diasRestantes <= 30) {
        normalized.status = "Vence≤30d";
      } else if (!statusKey) {
        normalized.status = "Válido";
      }
    }
  }

  return normalized;
};

export const normalizeCertificadoFromApi = (item) => {
  if (!item || typeof item !== "object") return item;
  const normalized = { ...item };

  // id / cert_id
  const idCandidates = [item.id, item.cert_id, item.certId];
  for (const candidate of idCandidates) {
    const parsed = toFiniteNumber(candidate);
    if (parsed !== undefined) {
      normalized.id = parsed;
      normalized.cert_id = parsed;
      break;
    }
  }

  // org_id string
  if (normalized.org_id != null) {
    normalized.org_id = String(normalized.org_id);
  }

  // titular base: empresa (ou fallback da view/subject)
  let titular =
    normalized.titular ??
    normalized.empresa ??
    normalized.subject ??
    "";

  // Se NÃO houver empresa vinculada (empresa_id nulo),
  // assumimos que é pessoa física e normalizamos o nome.
  if (
    (normalized.empresa_id === null || normalized.empresa_id === undefined) &&
    titular
  ) {
    titular = normalizeNomePessoa(titular);
  }

  normalized.titular = titular;

  // datas snake_case → camelCase
  if (normalized.validoDe === undefined && normalized.valido_de !== undefined) {
    normalized.validoDe = normalized.valido_de;
  }
  if (normalized.validoAte === undefined && normalized.valido_ate !== undefined) {
    normalized.validoAte = normalized.valido_ate;
  }

  // diasRestantes recalculado pela data de validade
  const diasRestantes = computeDiasRestantes(normalized.validoAte ?? normalized.valido_ate);
  if (diasRestantes !== null) {
    normalized.diasRestantes = diasRestantes;
    normalized.dias_restantes = diasRestantes;

    const situacaoKey = getStatusKey(normalized.situacao);
    if (diasRestantes < 0) {
      normalized.situacao = "Vencido";
    } else if (diasRestantes <= 7) {
      if (!situacaoKey || situacaoKey.includes("venc") || situacaoKey.includes("valido")) {
        normalized.situacao = "Vencendo em breve";
      }
    } else if (!situacaoKey) {
      normalized.situacao = "Válido";
    }
  }

  return normalized;
};

export const mapKpiItemsToRecord = (items) => {
  if (!Array.isArray(items)) {
    return {};
  }
  return items.reduce((acc, item) => {
    if (!item || typeof item !== "object") {
      return acc;
    }
    const key = item.chave ?? item.key ?? item.slug;
    if (!key) {
      return acc;
    }
    const valueCandidate =
      item.valor ?? item.value ?? item.total ?? item.quantidade ?? item.count ?? 0;
    const parsedValue = toFiniteNumber(valueCandidate);
    acc[key] = parsedValue ?? 0;
    return acc;
  }, {});
};

const normalizeCollectionPayload = (payload, mapper) => {
  const itemsSource = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload)
      ? payload
      : [];
  const normalizedItems = mapper ? itemsSource.map((item) => mapper(item)) : itemsSource;
  const total = toFiniteNumber(payload?.total) ?? normalizedItems.length;
  const page = toFiniteNumber(payload?.page) ?? 1;
  const size = toFiniteNumber(payload?.size) ?? normalizedItems.length;
  return attachPaginationInfo(normalizedItems, { total, page, size });
};

const TAXA_TIPO_TO_KEY = {
  TPI: "tpi",
  Funcionamento: "func",
  Publicidade: "publicidade",
  "Sanitária": "sanitaria",
  "Localização/Instalação": "localizacao_instalacao",
  "Área Pública": "area_publica",
  Bombeiros: "bombeiros",
  "Status Geral": "status_geral",
};

const normalizeTaxaTipo = (tipo) => {
  if (typeof tipo !== "string") return "";
  return tipo
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
};

const NORMALIZED_TAXA_TIPO_TO_KEY = Object.entries(TAXA_TIPO_TO_KEY).reduce(
  (acc, [label, key]) => {
    const normalized = normalizeTaxaTipo(label);
    if (normalized) {
      acc[normalized] = key;
    }
    return acc;
  },
  {},
);

const TAXA_COLUMN_KEYS = Object.values(TAXA_TIPO_TO_KEY);
const TAXA_STATUS_GERAL_KEYS = Object.entries(TAXA_TIPO_TO_KEY)
  .filter(([label]) => label !== "TPI" && label !== "Bombeiros" && label !== "Status Geral")
  .map(([, key]) => key);

const isTaxaEmAberto = (status) => {
  if (status === undefined || status === null) return false;
  const normalized = String(status)
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (!normalized || normalized === "*" || normalized === "-" || normalized === "—") {
    return false;
  }
  const hasSlashRatio = /\d+\s*\/\s*\d+/u.test(normalized);
  return hasSlashRatio || normalized.includes("abert");
};

const applyTaxaStatusGeral = (collection) => {
  if (!Array.isArray(collection)) return collection;
  collection.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const hasAberta = TAXA_STATUS_GERAL_KEYS.some((key) => isTaxaEmAberto(item[key]));
    item.status_geral = hasAberta ? "Irregular" : "Regular";
  });
  return collection;
};

const normalizeTaxasFromApi = (payload) => {
  const collection = normalizeCollectionPayload(payload);
  const metadata = {
    total: collection.total,
    page: collection.page,
    size: collection.size,
  };

  const itemsSource = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload)
      ? payload
      : [];

  const hasTipoEntries = itemsSource.some(
    (item) => item && typeof item === "object" && Object.hasOwn(item, "tipo"),
  );
  const alreadyWide = itemsSource.some(
    (item) => item && typeof item === "object" && TAXA_COLUMN_KEYS.some((key) => key in item),
  );

  if (!hasTipoEntries || alreadyWide) {
    return applyTaxaStatusGeral(collection);
  }

  const grouped = [];
  const byEmpresa = new Map();

  itemsSource.forEach((item) => {
    if (!item || typeof item !== "object") return;

    const empresaId = toFiniteNumber(item.empresa_id ?? item.empresaId ?? item.id);
    if (empresaId === undefined) return;

    let group = byEmpresa.get(empresaId);
    if (!group) {
      group = {
        ...item,
        empresaId,
        empresa_id: empresaId,
      };
      byEmpresa.set(empresaId, group);
      grouped.push(group);
    }

    const mappedKey = NORMALIZED_TAXA_TIPO_TO_KEY[normalizeTaxaTipo(item.tipo)];
    const statusValue =
      item.status ?? item.status_taxas ?? item.statusTaxa ?? item.status_tipo ?? item.statusTipo;
    if (mappedKey && statusValue !== undefined) {
      group[mappedKey] = statusValue;
    }

    if (group.empresa === undefined && item.empresa !== undefined) {
      group.empresa = item.empresa;
    }
    if (group.cnpj === undefined && item.cnpj !== undefined) {
      group.cnpj = item.cnpj;
    }
    if (group.municipio === undefined && item.municipio !== undefined) {
      group.municipio = item.municipio;
    }
    if (!group.data_envio && item.data_envio) {
      group.data_envio = item.data_envio;
    }
  });

  return applyTaxaStatusGeral(attachPaginationInfo(grouped, metadata));
};

const DEFAULT_TRANSFORMS = {
  "/empresas": (payload) => normalizeCollectionPayload(payload, normalizeEmpresaFromApi),
  "/alertas": (payload) => normalizeCollectionPayload(payload, normalizeAlertaFromApi),
  "/licencas": (payload) => normalizeCollectionPayload(payload, normalizeLicencaFromApi),
  "/processos": (payload) => normalizeCollectionPayload(payload),
  "/taxas": (payload) => normalizeTaxasFromApi(payload),
  "/certificados": (payload) =>
    normalizeCollectionPayload(payload, normalizeCertificadoFromApi),
  "/kpis": (payload) => {
    if (payload && typeof payload === "object" && !Array.isArray(payload) && !payload.items) {
      return payload;
    }
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return mapKpiItemsToRecord(items);
  },
};

const request = async (path, options = {}) => {
  const { method = "GET", headers, query, body } = options;
  const endpointPath = resolveEndpointPath(path);
  const url = buildAbsoluteUrl(endpointPath, query);
  const finalHeaders = buildHeaders(headers);
  const requestInit = { method, headers: finalHeaders };

  if (body !== undefined && body !== null) {
    if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
      requestInit.body = body;
    } else if (typeof body === "string") {
      requestInit.body = body;
    } else {
      if (!finalHeaders.has("Content-Type")) {
        finalHeaders.set("Content-Type", "application/json");
      }
      requestInit.body = JSON.stringify(body);
    }
  }

  return fetch(url, requestInit);
};

const buildErrorMessage = async (response) => {
  let detail = "";
  try {
    const data = await response.clone().json();
    detail = data?.detail || data?.message || data?.error;
    if (!detail && data && typeof data === "object") {
      detail = JSON.stringify(data);
    }
  } catch (jsonError) {
    try {
      detail = await response.clone().text();
    } catch (textError) {
      detail = "";
    }
  }
  const statusLabel = `Erro ${response.status}`;
  return detail ? `${statusLabel}: ${detail}` : statusLabel;
};

export const apiUrl = (path = "", query) => {
  const endpointPath = resolveEndpointPath(path);
  return buildAbsoluteUrl(endpointPath, query);
};

export const fetchJson = async (path, options = {}) => {
  const { transform, ...rest } = options || {};
  const response = await request(path, rest);
  if (!response.ok) {
    if (response.status === 404) {
      return { items: [], total: 0, page: 1, size: 0 };
    }
    const message = await buildErrorMessage(response);
    throw new Error(message);
  }
  if (response.status === 204) {
    return null;
  }
  let data;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }
  const canonical = getCanonicalKey(path);
  const transformer = transform || DEFAULT_TRANSFORMS[canonical];
  return typeof transformer === "function" ? transformer(data) : data;
};
