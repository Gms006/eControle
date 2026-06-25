import React from "react";
import { Clipboard, Clock, FileText, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const SummaryCard = ({ label, value, icon: Icon, helper = "", tone = "default" }) => {
  const toneClasses =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-600"
      : tone === "warn"
        ? "bg-amber-50 text-amber-600"
        : "bg-indigo-50 text-indigo-600";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-[2rem] font-semibold leading-none tracking-tight text-slate-950">{value}</p>
          {helper ? <p className={cn("text-sm font-medium", tone === "warn" ? "text-amber-600" : "text-slate-500")}>{helper}</p> : null}
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", toneClasses)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

export default function ProcessSummaryCards({ situacaoResumo }) {
  return (
    <>
      <SummaryCard label="Total de processos" value={situacaoResumo.total} icon={Clipboard} />
      <SummaryCard label="Em análise" value={situacaoResumo.emAnalise} icon={FileText} />
      <SummaryCard label="Pendentes" value={situacaoResumo.pendentes} icon={Clock} helper="Requer ação" tone="warn" />
      <SummaryCard label="Deferidos" value={situacaoResumo.deferidos} icon={ShieldCheck} tone="ok" />
    </>
  );
}
