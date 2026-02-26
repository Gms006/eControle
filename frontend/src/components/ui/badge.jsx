import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = {
  default:
    "border border-slate-200 bg-white text-slate-700",
  secondary:
    "border border-slate-200 bg-slate-100 text-slate-700",
  outline:
    "border border-slate-200 bg-transparent text-slate-700",
  success:
    "border border-emerald-100 bg-emerald-50 text-emerald-700",
  warning:
    "border border-amber-100 bg-amber-50 text-amber-700",
  danger:
    "border border-rose-100 bg-rose-50 text-rose-700",
  info: "border border-sky-100 bg-sky-50 text-sky-700",
};

export function Badge({
  className,
  variant = "default",
  ...props
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export default Badge;
