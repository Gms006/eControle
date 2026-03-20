import React from "react";

const baseChip =
  "inline-flex items-center font-medium rounded-full whitespace-nowrap";

const chipSizeClasses = {
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-sm px-2.5 py-1 gap-1.5",
  lg: "text-sm px-3 py-1.5 gap-2",
};

const chipVariantClasses = {
  neutral: "bg-slate-200 text-slate-800 border border-slate-300",
  success: "bg-emerald-200 text-emerald-900 border border-emerald-300",
  danger: "bg-red-200 text-red-900 border border-red-300",
  warning: "bg-amber-200 text-amber-900 border border-amber-300",
  info: "bg-blue-200 text-blue-900 border border-blue-300",
  purple: "bg-violet-200 text-violet-900 border border-violet-300",
  teal: "bg-teal-50 text-teal-700 border border-teal-200",
  indigo: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  fire: "bg-red-300 text-red-950 border border-red-400",
  brown: "bg-amber-900/15 text-amber-950 border border-amber-900/35",
  outline: "bg-transparent text-slate-600 border border-slate-300",
  ghost: "bg-transparent border-transparent text-slate-500",
};

const chipVariantSolidClasses = {
  neutral: "bg-slate-500 text-white border border-slate-600",
  success: "bg-emerald-600 text-white border border-emerald-700",
  danger: "bg-red-600 text-white border border-red-700",
  warning: "bg-amber-500 text-white border border-amber-600",
  info: "bg-blue-600 text-white border border-blue-700",
  purple: "bg-violet-600 text-white border border-violet-700",
  teal: "bg-teal-200 text-white border border-teal-700",
  indigo: "bg-indigo-600 text-white border border-indigo-700",
  fire: "bg-red-700 text-white border border-red-800",
  brown: "bg-amber-900 text-white border border-amber-950",
  outline: "bg-white text-slate-700 border border-slate-400",
  ghost: "bg-transparent border-transparent text-slate-600",
};

const dotColorClasses = {
  neutral: "bg-slate-400",
  success: "bg-emerald-500",
  danger: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  purple: "bg-violet-500",
  teal: "bg-teal-300",
  indigo: "bg-indigo-500",
  fire: "bg-red-700",
  brown: "bg-amber-900",
  outline: "bg-slate-400",
  ghost: "bg-slate-400",
};

export function Chip({
  children,
  variant = "neutral",
  size = "sm",
  solid = false,
  dot = false,
  icon = null,
  className = "",
  ...props
}) {
  const useSolidPalette = solid && !["outline", "ghost"].includes(variant);
  const palette = useSolidPalette ? chipVariantSolidClasses : chipVariantClasses;
  const variantClass = palette[variant] || palette.neutral;
  const sizeClass = chipSizeClasses[size] || chipSizeClasses.sm;
  const dotColorClass = dotColorClasses[variant] || dotColorClasses.neutral;
  return (
    <span className={[baseChip, sizeClass, variantClass, className].join(" ")} {...props}>
      {dot ? <span className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotColorClass}`} /> : null}
      {icon ? <span className="flex-shrink-0">{icon}</span> : null}
      {children}
    </span>
  );
}
