import React from "react";
import { Trash2 } from "lucide-react";

export default function ProcessDrawerSidebar({
  modal,
  form,
  companyInitials,
  companyLabel,
  statusLabel,
  municipioLabel,
  servicoLabel,
  notificacaoLabel,
  isDeleting,
  onRemove,
}) {
  return (
    <aside className="flex shrink-0 flex-col p-5" style={{ width: "220px", background: "#0f2035" }}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md text-sm font-semibold" style={{ background: "#1e4d7a", color: "#cfe5fa" }}>
            {companyInitials}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide" style={{ color: "#6b8aaa" }}>Razão Social</p>
            <p className="truncate text-sm font-medium" style={{ color: "#e2ecf6" }}>{companyLabel}</p>
            <p className="mt-2 text-[10px] uppercase tracking-wide" style={{ color: "#6b8aaa" }}># Protocolo</p>
            <p className="truncate text-xs" style={{ color: "#a8c0da" }}>{form.protocolo || "—"}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium" style={{ background: "#1c3d28", color: "#5eba82" }}>
            {statusLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Situação", value: statusLabel || "—" },
            { label: "Município", value: municipioLabel || "—" },
            { label: "Serviço", value: servicoLabel || "—" },
            { label: "Notificação", value: notificacaoLabel || "—" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.05)" }}>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: "#6b8aaa" }}>{item.label}</p>
              <p className="mt-1 line-clamp-2 text-xs" style={{ color: "#e2ecf6" }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        {modal.mode === "edit" ? (
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition"
            style={{ border: "1px solid rgba(220,70,70,0.4)", color: "#e57373" }}
            disabled={isDeleting}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? "Excluindo..." : "Excluir processo"}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
