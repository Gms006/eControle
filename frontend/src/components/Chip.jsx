import React from "react";

const baseChip =
  "inline-flex items-center justify-center gap-1 border text-xs font-medium rounded-lg text-center";

const chipSizeClasses = {
  sm: "px-2 py-0.5",
  md: "px-2.5 py-1",
};

const chipVariantClasses = {
  neutral: "bg-slate-100 text-slate-700 border-subtle",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  outline: "bg-transparent text-slate-600 border-strong",
};

export function Chip({ children, variant = "neutral", size = "sm", className = "", ...props }) {
  return (
    <span className={[baseChip, chipSizeClasses[size], chipVariantClasses[variant], className].join(" ")} {...props}>
      {children}
    </span>
  );
}
