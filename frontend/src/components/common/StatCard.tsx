import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatCard({
  label,
  value,
  icon,
  hint,
  accentClassName,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  accentClassName?: string;
}) {
  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white shadow-panel">
      <CardContent className="p-0">
        <div className={cn("h-1 w-full bg-slate-200", accentClassName)} />
        <div className="flex items-start justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold leading-none text-slate-900">{value}</p>
            {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
          </div>
          {icon ? (
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
              {icon}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
