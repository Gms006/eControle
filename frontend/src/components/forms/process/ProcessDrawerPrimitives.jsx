import React from "react";

export const PROCESS_DRAWER_FIELD_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[13px] text-slate-900 focus:border-[#1a4a7a] focus:outline-none focus:ring-2 focus:ring-[#1a4a7a]/15";

const LABEL_CLASS = "text-xs font-medium text-slate-500";

export const AMBIENTAL_OPERACAO_OPTIONS = [
  { value: "dispensa_ambiental", label: "Dispensa Ambiental" },
  { value: "licenca_ambiental", label: "Licen\u00e7a Ambiental" },
];

export const PROCESS_TYPE_OPTIONS = [
  { value: "DIVERSOS", label: "Diversos" },
  { value: "FUNCIONAMENTO", label: "Funcionamento" },
  { value: "CERCON", label: "CERCON/Bombeiro" },
  { value: "USO_DO_SOLO", label: "Uso do Solo" },
  { value: "LICENCA_AMBIENTAL", label: "Licen\u00e7a Ambiental" },
  { value: "ALVARA_SANITARIO", label: "Sanit\u00e1rio" },
];

export const PROCESS_DRAWER_TABS = [
  { key: "dados", label: "Dados" },
  { key: "detalhes", label: "Detalhes" },
  { key: "observacao", label: "Observa\u00e7\u00e3o" },
];

export function ProcessDrawerFieldBlock({ label, required = false, className = "", children }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <p className={LABEL_CLASS}>
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </p>
      {children}
    </div>
  );
}

export function ProcessDrawerSectionHeader({ title, subtitle }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}
