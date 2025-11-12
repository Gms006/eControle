export const normalizeApiBase = (rawBase) => {
  const fallback = "/api";
  const trimmed = rawBase?.trim();
  const base = trimmed && trimmed !== "" ? trimmed : fallback;
  const collapseExtraSlashes = (value) => {
    if (!value) return value;
    const placeholder = "__TMP_PROTOCOL__";
    const placeholderRegex = new RegExp(placeholder, "g");
    const [path, ...rest] = value.split("?");
    const withPlaceholder = path.replace(/:\/\//g, placeholder);
    const collapsedPath = withPlaceholder
      .replace(/\/{2,}/g, "/")
      .replace(placeholderRegex, "://");
    return rest.length > 0 ? `${collapsedPath}?${rest.join("?")}` : collapsedPath;
  };
  const collapsed = collapseExtraSlashes(base);
  const withoutTrailing = collapsed.replace(/\/+$/, "");
  const ensuredSuffix = withoutTrailing.endsWith("/api")
    ? withoutTrailing
    : `${withoutTrailing || ""}/api`;
  const withLeadingSlash =
    ensuredSuffix.startsWith("http://") || ensuredSuffix.startsWith("https://")
      ? ensuredSuffix
      : ensuredSuffix.startsWith("/")
        ? ensuredSuffix
        : `/${ensuredSuffix}`;
  return collapseExtraSlashes(withLeadingSlash);
};

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);

export const apiUrl = (path = "") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
};

export const fetchJson = async (path) => {
  const response = await fetch(apiUrl(path));
  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.detail || JSON.stringify(payload);
    } catch (jsonError) {
      try {
        detail = await response.text();
      } catch (textError) {
        detail = "";
      }
    }
    const message = detail ? `Erro ${response.status}: ${detail}` : `Erro ${response.status}`;
    throw new Error(message);
  }
  return await response.json();
};
