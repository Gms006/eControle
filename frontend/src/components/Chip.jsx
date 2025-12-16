import React from "react";

const baseChip =
  "inline-flex items-center justify-center gap-1 border text-xs font-medium rounded-lg text-center";

const chipSizeClasses = {
  sm: "px-2 py-0.5",
  md: "px-2.5 py-1",
};

const chipVariantClasses = {
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
  success: "bg-green-50 text-green-700 border-green-100",
  danger: "bg-red-50 text-red-700 border-red-100",
  warning: "bg-amber-50 text-amber-700 border-amber-100",
  outline: "bg-transparent text-slate-600 border-slate-300",
};

export function Chip({ children, variant = "neutral", size = "sm", className = "" }) {
  return (
    <span className={[baseChip, chipSizeClasses[size], chipVariantClasses[variant], className].join(" ")}>
      {children}
    </span>
  );
}
