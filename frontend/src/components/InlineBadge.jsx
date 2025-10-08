import React from "react";

function InlineBadge({ children, className = "", variant = "solid", ...props }) {
  const base =
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium";
  
  // Se className contém classes de cor (bg-, text-, border-), não aplicar variant
  const hasCustomColors = /\b(bg-|text-|border-)\w+/.test(className);
  
  const variants = {
    solid: "bg-slate-100 border-transparent text-slate-700",
    outline: "bg-white border-slate-200 text-slate-600",
    plain: "bg-transparent border-transparent text-slate-500",
  };
  
  const variantClasses = hasCustomColors ? "" : (variants[variant] || variants.solid);
  
  return (
    <span className={`${base} ${variantClasses} ${className}`} {...props}>
      {children}
    </span>
  );
}

export default InlineBadge;
