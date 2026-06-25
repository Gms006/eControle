import React from "react";
import { SideDrawer } from "@/components/ui/side-drawer";
import { cn } from "@/lib/utils";

const InfoItem = ({ label, children, className = "" }) => (
  <div className={cn("space-y-1 rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2.5", className)}>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <div className="text-sm text-slate-800">{children ?? "—"}</div>
  </div>
);

export default function ProcessDetailsDrawer({ detailsDrawer, detailsFields, onClose, renderFieldValue }) {
  return (
    <SideDrawer
      open={detailsDrawer.open}
      onClose={onClose}
      title={detailsDrawer?.processo?.empresa || "Campos do tipo"}
      subtitle={detailsDrawer?.processo ? `Campos do tipo: ${detailsDrawer.processo.tipoDisplay || detailsDrawer.processo.tipo || "Processo"}` : "Campos do tipo"}
    >
      {detailsDrawer.processo ? (
        <div className="space-y-3">
          {detailsFields.length > 0 ? (
            detailsFields.map((field) => (
              <InfoItem key={field.key} label={field.label}>
                {renderFieldValue(field)}
              </InfoItem>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Tipo sem campos específicos configurados.
            </div>
          )}
        </div>
      ) : null}
    </SideDrawer>
  );
}
