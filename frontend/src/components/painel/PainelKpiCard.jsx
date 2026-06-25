export default function PainelKpiCard({
  title,
  value,
  subtitle,
  icon,
  segments,
  accent = "blue",
  subtitleTone = "amber",
}) {
  const accentMap = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    orange: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    red: "border-rose-200 bg-rose-50 text-rose-700",
  };

  const subtitleToneMap = {
    green: "text-emerald-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    red: "text-rose-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          <p className={`mt-1 text-xs ${subtitleToneMap[subtitleTone] || "text-slate-600"}`}>{subtitle}</p>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${accentMap[accent] || accentMap.blue}`}>
          {icon}
        </span>
      </div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-300">
        <div className="flex h-full w-full gap-4 px-2">
          {segments.length === 0 ? (
            <div className="h-full w-full bg-slate-300" />
          ) : (
            segments.map((segment) => (
              <div
                key={segment.key}
                className={segment.className}
                style={{ width: `clamp(8px, ${segment.width}, 14%)` }}
                title={`${segment.label}: ${segment.value}`}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
