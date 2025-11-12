const DEFAULT_API_BASE = "http://localhost:8000";
const API_PATH = "/api/v1";

const trim = (value) => (typeof value === "string" ? value.trim() : value ?? "");
const removeTrailingSlashes = (value) => String(value).replace(/\/+$/, "");

const resolveBase = (override) => {
  const overrideTrimmed = trim(override);
  if (overrideTrimmed) {
    return removeTrailingSlashes(overrideTrimmed);
  }

  const envBase = trim(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL);
  if (envBase) {
    return removeTrailingSlashes(envBase);
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (port === "5173") {
      return `${protocol}//${hostname}:8000`;
    }
    if (port) {
      return `${protocol}//${hostname}:${port}`;
    }
    return `${protocol}//${hostname}`;
  }

  return DEFAULT_API_BASE;
};

const apiRoot = resolveBase();

const ensureLeadingSlash = (path = "") => (path.startsWith("/") ? path : `/${path}`);

export const normalizeApiBase = (rawBase) => `${resolveBase(rawBase)}/api`;
export const API_ROOT = apiRoot;
export const API_BASE_URL = `${apiRoot}${API_PATH}`;

const readToken = () => {
  try {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("jwt");
      if (stored) {
        return stored;
      }
    }
  } catch (error) {
    console.warn("[api] Falha ao ler token do localStorage", error);
  }
  return import.meta.env.VITE_DEV_TOKEN || "";
};

const buildHeaders = (extraHeaders = {}) => {
  const headers = new Headers(extraHeaders);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  const token = readToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
};

const appendSearchParams = (url, params) => {
  if (!params || typeof params !== "object") {
    return;
  }
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null) {
          url.searchParams.append(key, item);
        }
      });
      return;
    }
    url.searchParams.set(key, value);
  });
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const text = await response.text();
    const error = new Error("API request failed");
    error.status = response.status;
    error.statusText = response.statusText;
    error.body = text;
    throw error;
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
};

const request = async (path, { method = "GET", params, headers, body } = {}) => {
  const url = new URL(`${API_BASE_URL}${ensureLeadingSlash(path)}`);
  appendSearchParams(url, params);

  const init = {
    method,
    headers: buildHeaders(headers),
    credentials: "include",
  };

  if (body !== undefined && body !== null) {
    const isBlob = typeof Blob !== "undefined" && body instanceof Blob;
    if (body instanceof FormData || isBlob) {
      init.body = body;
    } else if (typeof body === "string") {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);
      if (!init.headers.has("Content-Type")) {
        init.headers.set("Content-Type", "application/json");
      }
    }
  }

  const response = await fetch(url.toString(), init);
  return handleResponse(response);
};

export const fetchJson = (path, options = {}) => request(path, options);
export const buildApiUrl = (path = "") => `${API_BASE_URL}${ensureLeadingSlash(path)}`;
export const buildAbsoluteUrl = (path = "") => `${apiRoot}${ensureLeadingSlash(path)}`;
export const getAuthToken = () => readToken();

const api = {
  async get(path, options) {
    const data = await request(path, { ...options, method: "GET" });
    return { data };
  },
};

export default api;
