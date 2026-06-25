import React from "react";
import { cn } from "@/lib/utils";

export default function CompaniesKpiCards({ cards }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const iconTone =
          card.key === "ativas"
            ? "border-emerald-200 bg-emerald-50 text-emerald-600"
            : card.key === "riscoAlto"
              ? "border-rose-200 bg-rose-50 text-rose-600"
              : card.key === "score"
                ? "border-amber-200 bg-amber-50 text-amber-600"
                : "border-blue-200 bg-blue-50 text-blue-600";
        const subtitleTone = card.key === "riscoAlto" ? "text-amber-600" : "text-slate-500";

        return (
          <div key={card.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold leading-none">{card.value}</p>
                <p className={cn("mt-2 text-xs", subtitleTone)}>{card.subtitle}</p>
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
