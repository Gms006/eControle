import axios from "axios";

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

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = readToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const buildApiUrl = (path = "") => {
  const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${sanitizedPath}`;
};

export const buildAbsoluteUrl = (path = "") => {
  const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiRoot}${sanitizedPath}`;
};

export const getAuthToken = () => readToken();

export default api;
