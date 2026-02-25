import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PillVariant = "neutral" | "ok" | "warn" | "danger" | "info";

const VARIANT_CLASSES: Record<PillVariant, string> = {
  neutral: "border-slate-200 bg-white text-slate-700",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
};

export function Pill({
  className,
  variant = "neutral",
  children,
}: {
  className?: string;
  variant?: PillVariant;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export default Pill;
