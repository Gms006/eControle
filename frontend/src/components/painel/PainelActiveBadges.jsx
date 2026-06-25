import { X } from "lucide-react";

export default function PainelActiveBadges({ badges, onClearBadge }) {
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <button
          key={badge.key}
          type="button"
          onClick={() => onClearBadge?.(badge.key)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          title="Remover filtro"
        >
          {badge.label}
          <X className="h-3.5 w-3.5" />
        </button>
      ))}
      {badges.length === 0 ? (
        <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
          Sem filtros adicionais ativos
        </span>
      ) : null}
    </div>
  );
}
