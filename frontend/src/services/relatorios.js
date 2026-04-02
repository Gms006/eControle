import { apiUrl, fetchJson } from "@/lib/api";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const getToken = () => {
  try {
    return (window.localStorage.getItem("access_token") || "").trim();
  } catch {
    return "";
  }
};

const resolveFilename = (contentDisposition) => {
  if (!contentDisposition) return "relatorio_eControle.xlsx";
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const plainMatch = contentDisposition.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) return plainMatch[1].trim();
  return "relatorio_eControle.xlsx";
};

const triggerDownload = (blob, filename) => {
  const link = document.createElement("a");
  const href = URL.createObjectURL(blob);
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
};

const readErrorMessage = async (response) => {
  try {
    const json = await response.clone().json();
    return json?.detail?.message || json?.detail || json?.message || "";
  } catch {
    try {
      return (await response.clone().text()) || "";
    } catch {
      return "";
    }
  }
};

export const listarCamposRelatorio = async () => {
  return fetchJson("/api/v1/relatorios/campos");
};

export const exportarRelatorio = async ({ campos }) => {
  const token = getToken();
  const response = await fetch(apiUrl("/api/v1/relatorios/exportar"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: XLSX_MIME,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ campos }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `Falha ao exportar relatório (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  const filename = resolveFilename(response.headers.get("content-disposition"));
  triggerDownload(blob, filename);
};
