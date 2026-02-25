import React from "react";
import { Chip } from "@/components/Chip";

const baseCardClasses =
  "flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white shadow-sm px-4 py-3";

const IconBadge = ({ icon: Icon, corClasse }) => (
  <div
    className={`flex h-10 w-10 items-center justify-center rounded-2xl ${corClasse} bg-opacity-10 text-opacity-90`}
  >
    <Icon className="h-5 w-5" />
  </div>
);

export function ResumoTipoCardLicenca({ tipo, total, icon, corClasse, stats }) {
  return (
    <div className={baseCardClasses}>
      <div className="flex items-center gap-3">
        <IconBadge icon={icon} corClasse={corClasse} />
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">{tipo}</p>
          <p className="text-2xl font-semibold leading-tight text-slate-900">{total}</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 text-xs">
        {stats.possui > 0 && <Chip variant="success">Possui {stats.possui}</Chip>}
        {stats.ate30d > 0 && <Chip variant="warning">≤ 30d {stats.ate30d}</Chip>}
        {stats.vencido > 0 && <Chip variant="danger">Vencido {stats.vencido}</Chip>}
        {stats.sujeito > 0 && <Chip variant="warning">Sujeito {stats.sujeito}</Chip>}
        {stats.dispensa > 0 && <Chip variant="neutral">Dispensa {stats.dispensa}</Chip>}
      </div>
    </div>
  );
}

export function ResumoTipoCardTaxa({ tipo, total, icon, corClasse, stats }) {
  return (
    <div className={baseCardClasses}>
      <div className="flex items-center gap-3">
        <IconBadge icon={icon} corClasse={corClasse} />
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">{tipo}</p>
          <p className="text-2xl font-semibold leading-tight text-slate-900">{total}</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 text-xs">
        {stats.ok > 0 && <Chip variant="success">OK {stats.ok}</Chip>}
        {stats.alerta > 0 && <Chip variant="warning">Alertas {stats.alerta}</Chip>}
        {stats.semStatus > 0 && (
          <Chip variant="neutral">Sem status {stats.semStatus}</Chip>
        )}
      </div>
    </div>
  );
}
