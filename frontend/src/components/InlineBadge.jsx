import React from "react";

function InlineBadge({ children, className = "", variant = "solid", ...props }) {
  const base =
    "inline-flex items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-center text-xs font-medium";
  
  const variants = {
    solid: "bg-slate-100 border-transparent text-slate-700",
    outline: "bg-white border-slate-200 text-slate-600",
    plain: "bg-transparent border-transparent text-slate-500",
  };

  const variantClasses = variants[variant] || variants.solid;

  const hasCustomBg = /\bbg-[\w/-]+/.test(className);
  const hasCustomBorder = /\bborder-[\w/-]+/.test(className);
  const hasCustomText = /\btext-[\w/-]+/.test(className);

  const pickVariantPart = (pattern) =>
    (variantClasses.match(pattern) || []).join(" ");

  const composedVariantClasses =
    hasCustomBg || hasCustomBorder || hasCustomText
      ? [
          hasCustomBg ? "" : pickVariantPart(/\bbg-[^\s]+/g),
          hasCustomBorder ? "" : pickVariantPart(/\bborder-[^\s]+/g),
          hasCustomText ? "" : pickVariantPart(/\btext-[^\s]+/g),
        ]
          .filter(Boolean)
          .join(" ")
      : variantClasses;
  
  return (
    <span className={`${base} ${composedVariantClasses} ${className}`} {...props}>
      {children}
    </span>
  );
}

export default InlineBadge;
