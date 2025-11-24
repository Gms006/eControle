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
  if (normalized.responsavel_fiscal !== undefined && normalized.responsavelFiscal === undefined) {
    normalized.responsavelFiscal = normalized.responsavel_fiscal;
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

const DEFAULT_TRANSFORMS = {
  "/empresas": (payload) => {
    const itemsSource = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : [];
    const normalizedItems = itemsSource.map((item) => normalizeEmpresaFromApi(item));
    const total = toFiniteNumber(payload?.total) ?? normalizedItems.length;
    const page = toFiniteNumber(payload?.page) ?? 1;
    const size = toFiniteNumber(payload?.size) ?? normalizedItems.length;
    return attachPaginationInfo(normalizedItems, { total, page, size });
  },
  "/alertas": (payload) => {
    const itemsSource = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : [];
    const normalizedItems = itemsSource.map((item) => normalizeAlertaFromApi(item));
    const total = toFiniteNumber(payload?.total) ?? normalizedItems.length;
    const page = toFiniteNumber(payload?.page) ?? 1;
    const size = toFiniteNumber(payload?.size) ?? normalizedItems.length;
    return attachPaginationInfo(normalizedItems, { total, page, size });
  },
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
