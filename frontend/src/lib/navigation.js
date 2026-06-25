import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  Receipt,
  ScrollText,
  ShieldCheck,
} from "lucide-react";

export const APP_NAV_ITEMS = [
  {
    key: "painel",
    label: "Painel",
    icon: LayoutDashboard,
    description: "Vis\u00e3o geral e alertas",
  },
  {
    key: "empresas",
    label: "Empresas",
    icon: Building2,
    description: "Cadastros e atalhos",
  },
  {
    key: "licencas",
    label: "Licen\u00e7as",
    icon: ScrollText,
    description: "Situa\u00e7\u00e3o por empresa/tipo",
  },
  {
    key: "taxas",
    label: "Taxas",
    icon: Receipt,
    description: "Pend\u00eancias e envios",
  },
  {
    key: "processos",
    label: "Processos",
    icon: FolderKanban,
    description: "Fluxo e observa\u00e7\u00f5es",
  },
  {
    key: "certificados",
    label: "Certificados",
    icon: ShieldCheck,
    description: "A1/A3 e vencimentos",
  },
];

const DOMAIN_SUBNAV_KEYS = new Set([
  "painel",
  "empresas",
  "licencas",
  "taxas",
  "processos",
  "certificados",
]);

export const DOMAIN_SUBNAV_ITEMS = APP_NAV_ITEMS.filter((item) => DOMAIN_SUBNAV_KEYS.has(item.key)).map((item) => ({
  key: item.key,
  label: item.label,
  icon: item.icon,
}));

export const APP_TAB_KEYS = APP_NAV_ITEMS.map((item) => item.key);

export const TAB_TITLES = {
  painel: {
    title: "Dashboard Operacional",
    subtitle: "Indicadores de monitoramento e alertas do escrit\u00f3rio.",
  },
  empresas: {
    title: "Gest\u00e3o de empresas",
    subtitle: "Empresas monitoradas com a\u00e7\u00f5es r\u00e1pidas e situa\u00e7\u00e3o consolidada.",
  },
  certificados: {
    title: "Certificados",
    subtitle: "Validade, situa\u00e7\u00e3o e credenciais vinculadas ao backend.",
  },
  licencas: {
    title: "Licen\u00e7as",
    subtitle: "Acompanhamento por empresa e por tipo de licen\u00e7a.",
  },
  taxas: {
    title: "Taxas",
    subtitle: "Status fiscais, TPI e registro de envios.",
  },
  processos: {
    title: "Processos",
    subtitle: "Andamento operacional, filtros e hist\u00f3rico de observa\u00e7\u00f5es.",
  },
  notificacoes: {
    title: "Notifica\u00e7\u00f5es",
    subtitle: "Central operacional para leitura, triagem e abertura r\u00e1pida das notifica\u00e7\u00f5es.",
  },
  automacoes: {
    title: "Automa\u00e7\u00f5es / Jobs",
    subtitle: "Opera\u00e7\u00e3o de jobs, filas, falhas e governan\u00e7a de execu\u00e7\u00e3o.",
  },
};

export const extractTabFromRoutePath = (routePath, origin = "http://localhost") => {
  if (!routePath || typeof routePath !== "string") return null;

  try {
    const url = new URL(routePath, origin);
    const fromQuery = String(url.searchParams.get("tab") || "").trim();
    if (APP_TAB_KEYS.includes(fromQuery)) return fromQuery;
    const segments = url.pathname.split("/").filter(Boolean);
    const last = (segments[segments.length - 1] || "").trim();
    if (APP_TAB_KEYS.includes(last)) return last;
  } catch {
    const simple = routePath.replace(/^\/+/, "").split(/[/?#]/)[0];
    if (APP_TAB_KEYS.includes(simple)) return simple;
  }

  return null;
};
