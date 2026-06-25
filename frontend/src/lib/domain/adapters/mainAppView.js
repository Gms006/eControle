import { getStatusKey, isAlertStatus, isProcessStatusActiveOrPending } from "@/lib/domain/status/common";
import { normalizeText, removeDiacritics } from "@/lib/text";

export const hasCompanyAlert = ({
  empresa,
  extractEmpresaId,
  licencasByEmpresa,
  taxasByEmpresa,
  processosByEmpresa,
}) => {
  const empresaId = extractEmpresaId(empresa);
  if (isAlertStatus(empresa?.debito)) return true;
  if (removeDiacritics(normalizeText(empresa?.debito)).toLowerCase().trim().includes("possui debito")) {
    return true;
  }
  if (empresa?.certificado && getStatusKey(empresa.certificado).includes("venc")) return true;
  if (empresaId === undefined) return false;

  const licList = licencasByEmpresa.get(empresaId) || [];
  if (licList.some((lic) => isAlertStatus(lic?.status))) return true;

  const taxa = taxasByEmpresa.get(empresaId);
  if (taxa) {
    const statusValues = Object.values(taxa).filter((value) => typeof value === "string");
    if (statusValues.some((value) => isAlertStatus(value))) return true;
  }

  const procList = processosByEmpresa.get(empresaId) || [];
  if (procList.some((proc) => isProcessStatusActiveOrPending(proc?.status))) return true;

  return false;
};

export const buildPanelHeaderStats = ({
  empresasCount,
  licencasCount,
  taxasCount,
  municipio,
  somenteAlertas,
}) => ({
  datasets: `${empresasCount}/${licencasCount}/${taxasCount}`,
  filtro: municipio === "Todos" ? "Todos" : municipio,
  alertas: somenteAlertas ? "Filtrados" : "Todos",
});

export const buildOperationCounts = ({
  errors,
  filteredLicencas,
  notificationsUnreadCount,
  processosNormalizados,
  workerHealth,
}) => ({
  notifications: Number(notificationsUnreadCount || 0),
  critical_queues:
    filteredLicencas.filter((item) => isAlertStatus(item?.status)).length +
    processosNormalizados.filter((item) => isProcessStatusActiveOrPending(item?.status)).length,
  saved_views: 0,
  automation_jobs: Number(workerHealth?.active_jobs || 0),
});

const TOPBAR_CONTEXT_BY_TAB = {
  empresas: {
    breadcrumb: "Empresas / Cadastro",
    title: "Gest\u00e3o de empresas",
    subtitle: "Vis\u00e3o operacional com filtros persistentes e a\u00e7\u00f5es r\u00e1pidas.",
  },
  licencas: {
    breadcrumb: "Licen\u00e7as / Vis\u00e3o geral",
    title: "Controle de licen\u00e7as",
    subtitle: "Gest\u00e3o operacional com subabas, filtros din\u00e2micos e monitoramento de vencimentos.",
  },
  taxas: {
    breadcrumb: "Taxas / Vis\u00e3o geral",
    title: "Gest\u00e3o de taxas municipais",
    subtitle: "Matriz semaf\u00f3rica por empresa com filtros persistentes e a\u00e7\u00e3o contextual.",
  },
  processos: {
    breadcrumb: "Processos / Kanban",
    title: "Processos regulat\u00f3rios",
    subtitle: "",
  },
  notificacoes: {
    breadcrumb: "Opera\u00e7\u00e3o / Notifica\u00e7\u00f5es",
    title: "Central de notifica\u00e7\u00f5es",
    subtitle: "Leitura operacional, filtros e a\u00e7\u00f5es r\u00e1pidas sobre notificadores do portal.",
  },
  automacoes: {
    breadcrumb: "Automa\u00e7\u00f5es / Jobs",
    title: "Automa\u00e7\u00f5es / Jobs",
    subtitle: "Execu\u00e7\u00e3o, filas e sa\u00fade operacional das automa\u00e7\u00f5es.",
  },
};

export const buildTopbarContext = ({ tab, navItems }) => {
  if (TOPBAR_CONTEXT_BY_TAB[tab]) {
    return TOPBAR_CONTEXT_BY_TAB[tab];
  }

  const activeItem = (Array.isArray(navItems) ? navItems : []).find((item) => item.key === tab);
  return {
    breadcrumb: "Painel / Hoje",
    title: activeItem?.label || "Painel",
    subtitle: activeItem?.description || "Vis\u00e3o operacional",
  };
};

/** @returns {{ label: string, variant?: "neutral" | "ok" | "warn" | "danger" | "info" }[]} */
export const buildPageChips = ({ activeNav, somenteAlertas, modoFoco }) => [
  { label: activeNav?.label || "Tela", variant: "info" },
  ...(somenteAlertas ? [{ label: "Somente alertas", variant: "warn" }] : []),
  ...(modoFoco ? [{ label: "Modo foco", variant: "ok" }] : []),
];
