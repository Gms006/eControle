const DEFAULT_API_BASE = "http://localhost:8000";

const normalizeBase = (raw) => {
  if (!raw) return DEFAULT_API_BASE;
  const trimmed = String(raw).trim();
  if (!trimmed) return DEFAULT_API_BASE;
  return trimmed.replace(/\/$/, "");
};

const apiRoot = normalizeBase(import.meta.env.VITE_API_BASE_URL);
export const API_ROOT = apiRoot;
export const API_BASE_URL = `${apiRoot}/api/v1`;

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
  const token = readToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
};

const buildUrl = (path = "", params) => {
  const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${sanitizedPath}`);
  if (params && typeof params === "object") {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item !== undefined && item !== null) {
            searchParams.append(key, item);
          }
        });
        return;
      }
      searchParams.set(key, value);
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url.search = queryString;
    }
  }
  return url.toString();
};

async function handleResponse(response) {
  if (!response.ok) {
    const text = await response.text();
    const error = new Error("API request failed");
    error.status = response.status;
    error.statusText = response.statusText;
    error.body = text;
    throw error;
  }
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export const buildApiUrl = (path = "") => {
  const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${sanitizedPath}`;
};

export const buildAbsoluteUrl = (path = "") => {
  const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiRoot}${sanitizedPath}`;
};

const api = {
  async get(path, { params, headers } = {}) {
    const url = buildUrl(path, params);
    const response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(headers),
      credentials: "include",
    });
    const data = await handleResponse(response);
    return { data };
  },
};

export const getAuthToken = () => readToken();

export default api;
