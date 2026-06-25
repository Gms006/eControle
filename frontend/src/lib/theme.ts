import { type LucideIcon } from "lucide-react";
import { APP_NAV_ITEMS as APP_NAV_ITEMS_BASE, TAB_TITLES as TAB_TITLES_BASE } from "@/lib/navigation";

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
  | "processos"
  | "notificacoes"
  | "automacoes";

export type NavItem = {
  key: AppTabKey;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const APP_NAV_ITEMS = APP_NAV_ITEMS_BASE as NavItem[];

export const TAB_TITLES = TAB_TITLES_BASE as Record<AppTabKey, { title: string; subtitle: string }>;
