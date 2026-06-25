import React from "react";
import { Chip } from "@/components/Chip";
import { cn } from "@/lib/utils";

export default function FilterToggleChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-soft",
        active
          ? "border-blue-300 bg-blue-50 text-blue-800"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      )}
      onClick={onClick}
      aria-pressed={active}
    >
      <Chip variant={active ? "success" : "neutral"} size="sm" className="rounded-full px-1.5 py-0">
        {active ? "ON" : "OFF"}
      </Chip>
      {label}
    </button>
  );
}
