import React from "react";
import { AlertTriangle, CheckCircle2, Clock3, Receipt } from "lucide-react";

const SUMMARY_CARD_STYLES = {
  total: { icon: Receipt, iconClass: "bg-slate-100 text-slate-700" },
  em_dia: { icon: CheckCircle2, iconClass: "bg-emerald-100 text-emerald-700" },
  pendente: { icon: Clock3, iconClass: "bg-amber-100 text-amber-700" },
  irregular: { icon: AlertTriangle, iconClass: "bg-rose-100 text-rose-700" },
};

function SummaryCard({ label, value, cardKey, helper }) {
  const Icon = SUMMARY_CARD_STYLES[cardKey].icon;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${SUMMARY_CARD_STYLES[cardKey].iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function TaxSummaryCards({ resumoCards, visibleCount }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Total" value={resumoCards.total} cardKey="total" helper={`${visibleCount} em exibi\u00e7\u00e3o`} />
      <SummaryCard label="Em dia" value={resumoCards.em_dia} cardKey="em_dia" />
      <SummaryCard label="Pendentes" value={resumoCards.pendente} cardKey="pendente" />
      <SummaryCard label="Irregulares" value={resumoCards.irregular} cardKey="irregular" />
    </div>
  );
}
