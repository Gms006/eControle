import React from "react";
import { X } from "lucide-react";
import { PROCESS_DRAWER_TABS } from "@/components/forms/process/ProcessDrawerPrimitives";

export default function ProcessDrawerHeader({
  headerEyebrow,
  headerTitle,
  activeTab,
  onTabChange,
  onClose,
}) {
  return (
    <header className="border-b border-slate-200 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{headerEyebrow}</p>
          <p className="mt-1 text-[18px] font-medium text-slate-900">{headerTitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-end gap-1">
        {PROCESS_DRAWER_TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={`border-b-2 px-2.5 py-2 text-sm transition ${
                active
                  ? "border-[#1a4a7a] font-medium text-[#1a4a7a]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
