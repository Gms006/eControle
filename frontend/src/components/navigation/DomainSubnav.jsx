import React from "react";
import { DOMAIN_SUBNAV_ITEMS } from "@/lib/navigation";

export default function DomainSubnav({ activeTab, onTabChange, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-2 shadow-sm ${className}`.trim()}>
      <div className="flex flex-wrap gap-2">
        {DOMAIN_SUBNAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange?.(item.key)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
