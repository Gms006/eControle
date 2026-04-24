// @ts-nocheck
import { motion } from "framer-motion";
import { AlertTriangle, BellRing, Bookmark, Bot, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BRAND_COLORS, type AppTabKey, type NavItem } from "@/lib/theme";

export default function Sidebar({
  items,
  activeTab,
  onTabChange,
  onOperationAction,
  operationCounts,
  onLogout,
}: {
  items: NavItem[];
  activeTab: AppTabKey;
  onTabChange: (key: AppTabKey) => void;
  onOperationAction?: (action: "notifications" | "critical_queues" | "saved_views" | "automation_jobs") => void;
  operationCounts?: Partial<Record<"notifications" | "critical_queues" | "saved_views" | "automation_jobs", number>>;
  onLogout: () => void;
}) {
  const operations = [
    { key: "notifications", label: "Notificações", icon: BellRing },
    { key: "critical_queues", label: "Filas críticas", icon: AlertTriangle },
    { key: "saved_views", label: "Views salvas", icon: Bookmark },
    { key: "automation_jobs", label: "Automação / Jobs", icon: Bot },
  ] as const;

  return (
    <aside className="ec-shell-sidebar hidden w-[264px] shrink-0 p-4 lg:flex lg:flex-col lg:gap-4">
      <div className="ec-sidebar-brand">
        <div className="flex items-center gap-3">
          <div className="ec-logo" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-white">eControle</p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-blue-100/70">Portal Operacional</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-blue-100/75">
          Navegação executiva com atalhos e contexto global preservado.
        </p>
      </div>

      <div className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-100/45">
        Principal
      </div>
      <nav className="space-y-1">
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;

          return (
            <motion.button
              key={item.key}
              type="button"
              whileTap={{ scale: 0.995 }}
              onClick={() => onTabChange(item.key)}
              data-testid={`nav-tab-${item.key}`}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                isActive
                  ? "border-blue-400/30 bg-blue-500/15 shadow-sm"
                  : "border-transparent bg-transparent hover:border-white/10 hover:bg-white/5",
              )}
              title={`Alt+${index + 1}`}
            >
              <div
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
                  isActive
                    ? "border-blue-300/60 bg-blue-50 text-blue-700"
                    : "border-white/10 bg-white/5 text-blue-100/90",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "text-sm font-semibold",
                    isActive ? "text-white" : "text-blue-50/90",
                  )}
                >
                  {item.label}
                </div>
                <div className="truncate text-xs text-blue-100/60">{item.description}</div>
              </div>
              <small
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                  isActive
                    ? "border-blue-200/60 bg-blue-50/20 text-blue-50"
                    : "border-white/10 bg-white/5 text-blue-100/50",
                )}
              >
                Alt+{index + 1}
              </small>
            </motion.button>
          );
        })}
      </nav>

      <div className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-100/45">
        Operação
      </div>
      <nav className="space-y-1">
        {operations.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onOperationAction?.(item.key)}
              className="group flex w-full items-center gap-3 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-left transition hover:border-white/10 hover:bg-white/5"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-blue-100/90">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-blue-50/90">{item.label}</div>
              </div>
              <small className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-blue-100/50">
                {Number(operationCounts?.[item.key] || 0)}
              </small>
            </button>
          );
        })}
      </nav>

      <div className="ec-sidebar-card mt-auto">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-100/70">
          Centro operacional
        </p>
        <p className="mt-1 text-xs text-blue-100/70">`Alt+1..6` navega entre abas</p>
        <p className="text-xs text-blue-100/70">`Ctrl/Cmd+K` foca busca global</p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full justify-start border-white/20 bg-white/5 text-blue-50 hover:bg-white/10"
          onClick={onLogout}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </aside>
  );
}
