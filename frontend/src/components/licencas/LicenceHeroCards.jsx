import React from "react";
import { Clock3, ScrollText, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const HERO_ICON_BY_KEY = {
  total: ScrollText,
  vencidas: ShieldAlert,
  vencendo: Clock3,
  pendentes: ShieldCheck,
};

export default function LicenceHeroCards({ items }) {
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
      {items.map((kpi) => {
        const Icon = HERO_ICON_BY_KEY[kpi.key] || ScrollText;
        const iconTone =
          kpi.key === "vencidas"
            ? "border-rose-200 bg-rose-50 text-rose-600"
            : kpi.key === "vencendo"
              ? "border-amber-200 bg-amber-50 text-amber-600"
              : "border-blue-200 bg-blue-50 text-blue-600";
        const subtitleTone = kpi.key === "vencidas" ? "text-amber-600" : "text-slate-500";

        return (
          <div key={kpi.key} className="h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
                <p className="mt-2 text-2xl font-semibold leading-none">{kpi.value}</p>
                <p className={cn("mt-2 text-xs", subtitleTone)}>{kpi.subtitle}</p>
              </div>
              <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl border", iconTone)}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
