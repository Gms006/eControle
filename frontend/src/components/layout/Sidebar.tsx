// @ts-nocheck
import { motion } from "framer-motion";
import { Crown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BRAND_COLORS, type AppTabKey, type NavItem } from "@/lib/theme";

export default function Sidebar({
  items,
  activeTab,
  onTabChange,
  onLogout,
}: {
  items: NavItem[];
  activeTab: AppTabKey;
  onTabChange: (key: AppTabKey) => void;
  onLogout: () => void;
}) {
  return (
    <aside className="hidden w-[280px] shrink-0 border-r border-slate-200/80 bg-white/80 p-4 backdrop-blur lg:flex lg:flex-col lg:gap-4">
      <div
        className="rounded-3xl p-4 text-white shadow-panel"
        style={{
          background: `linear-gradient(135deg, ${BRAND_COLORS.navy} 0%, ${BRAND_COLORS.blue} 100%)`,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">eControle</p>
            <p className="text-xs text-white/80">Theme CertHub</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-white/85">
          Navegação principal do portal operacional com filtros globais no topo.
        </p>
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
              className={cn(
                "group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                isActive
                  ? "border-blue-200 bg-blue-50 shadow-sm"
                  : "border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50",
              )}
              title={`Alt+${index + 1}`}
            >
              <div
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
                  isActive
                    ? "border-blue-200 bg-white text-blue-700"
                    : "border-slate-200 bg-white text-slate-600",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-sm font-semibold",
                    isActive ? "text-blue-900" : "text-slate-800",
                  )}
                >
                  {item.label}
                </div>
                <div className="truncate text-xs text-slate-500">{item.description}</div>
              </div>
            </motion.button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Atalhos
        </p>
        <p className="mt-1 text-xs text-slate-600">`Alt+1..6` navega entre telas</p>
        <p className="text-xs text-slate-600">`Ctrl/Cmd+K` foca a busca global</p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full justify-start"
          onClick={onLogout}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </aside>
  );
}
