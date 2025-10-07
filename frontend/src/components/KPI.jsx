import React from "react";
import { Card, CardContent } from "@/components/ui/card";

function KPI({ title, value, icon, accent }) {
  return (
    <Card className={`shadow-sm border-none ${accent}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-xl bg-white/70 text-slate-700">{icon}</div>
        <div>
          <div className="text-xs text-slate-600 uppercase tracking-wide">{title}</div>
          <div className="text-2xl font-semibold leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default KPI;
