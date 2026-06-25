import React from "react";

export const ProcessRailFilterBlock = ({ label, children }) => (
  <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">{label}</p>
    {children}
  </div>
);

export const getProcessRailChipClass = (active) => `rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
  active
    ? "border-blue-200 bg-blue-50 text-blue-700"
    : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-white"
}`;
