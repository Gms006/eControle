import { fetchJson } from "@/lib/api";

export const COPILOT_CATEGORIES = {
  COMPANY_SUMMARY: "COMPANY_SUMMARY",
  DOCUMENT_ANALYSIS: "DOCUMENT_ANALYSIS",
  RISK_SIMULATION: "RISK_SIMULATION",
  DUVIDAS_DIVERSAS: "DUVIDAS_DIVERSAS",
};

export const listCopilotCompanies = async ({ term = "", limit = 8 } = {}) => {
  return fetchJson("/api/v1/companies", {
    query: {
      limit,
      razao_social: term || undefined,
    },
  });
};

export const respondCopilot = async ({
  category,
  companyId,
  message,
  documentFile,
  signal,
}) => {
  const formData = new FormData();
  formData.append("category", category);
  if (companyId) {
    formData.append("company_id", companyId);
  }
  formData.append("message", message || "");
  if (documentFile) {
    formData.append("document", documentFile, documentFile.name);
  }
  return fetchJson("/api/v1/copilot/respond", {
    method: "POST",
    body: formData,
    signal,
  });
};
