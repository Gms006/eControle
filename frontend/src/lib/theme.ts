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
    description: "Visão geral e alertas",
  },
  {
    key: "empresas",
    label: "Empresas",
    icon: Building2,
    description: "Cadastros e atalhos",
  },
  {
    key: "certificados",
    label: "Certificados",
    icon: ShieldCheck,
    description: "A1/A3 e vencimentos",
  },
  {
    key: "licencas",
    label: "Licenças",
    icon: FileText,
    description: "Situação por empresa/tipo",
  },
  {
    key: "taxas",
    label: "Taxas",
    icon: Receipt,
    description: "Pendências e envios",
  },
  {
    key: "processos",
    label: "Processos",
    icon: Settings,
    description: "Fluxo e observações",
  },
];

export const TAB_TITLES: Record<AppTabKey, { title: string; subtitle: string }> = {
  painel: {
    title: "Dashboard Operacional",
    subtitle: "Indicadores de monitoramento e alertas do escritório.",
  },
  empresas: {
    title: "Empresas",
    subtitle: "Cadastros monitorados com ações rápidas e situação consolidada.",
  },
  certificados: {
    title: "Certificados",
    subtitle: "Validade, situação e credenciais vinculadas ao backend.",
  },
  licencas: {
    title: "Licenças",
    subtitle: "Acompanhamento por empresa e por tipo de licença.",
  },
  taxas: {
    title: "Taxas",
    subtitle: "Status fiscais, TPI e registro de envios.",
  },
  processos: {
    title: "Processos",
    subtitle: "Andamento operacional, filtros e histórico de observações.",
  },
};
