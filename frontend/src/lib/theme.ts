import {
  Building2,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export const BRAND_COLORS = {
  navy: "#0e2659",
  blue: "#22489c",
} as const;

export type AppTabKey =
  | "painel"
  | "empresas"
  | "certificados"
  | "licencas"
  | "taxas"
  | "processos";

export type NavItem = {
  key: AppTabKey;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const APP_NAV_ITEMS: NavItem[] = [
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
    icon: FileText,
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
    icon: Settings,
    description: "Fluxo e observa\u00e7\u00f5es",
  },
  {
    key: "certificados",
    label: "Certificados",
    icon: ShieldCheck,
    description: "A1/A3 e vencimentos",
  },
];

export const TAB_TITLES: Record<AppTabKey, { title: string; subtitle: string }> = {
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
};
