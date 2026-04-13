import React from "react";
import { Building2 } from "lucide-react";

function CopyableCompanyName({ value, onCopy, showIcon = false, size = "base", className = "" }) {
  const displayValue = (value || "").trim() || "—";

  const sizeClasses = {
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
  };

  const handleClick = (e) => {
    if (!value || !value.trim()) return;

    const isCtrlClick = e.ctrlKey || e.metaKey;

    if (isCtrlClick) {
      // Ctrl + clique = copia em FULL CAPSLOCK
      const upperValue = displayValue.toUpperCase();
      onCopy(
        upperValue,
        `Razão social copiada (EM MAIÚSCULAS): ${upperValue}`,
      );
    } else {
      // Clique normal = copia normalmente
      onCopy(
        displayValue,
        `Razão social copiada: ${displayValue}`,
      );
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!value || !value.trim()}
      className={`inline-flex items-center gap-1 rounded px-1 py-0.5 ${sizeClasses[size]} text-slate-700 font-semibold transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${className}`}
      title={value ? `Copiar razão social (Ctrl+clique para copiar em MAIÚSCULAS)` : ""}
    >
      {showIcon && <Building2 className="h-3 w-3 opacity-70" aria-hidden="true" />}
      <span>{displayValue}</span>
    </button>
  );
}

export default CopyableCompanyName;
