import React from "react";
import { Clipboard } from "lucide-react";
import { normalizeIdentifier } from "@/lib/text";

function CopyableIdentifier({ label, value, onCopy }) {
  const normalizedValue = normalizeIdentifier(value);
  const displayValue = normalizedValue || "—";
  return (
    <button
      type="button"
      onClick={() =>
        onCopy(
          normalizedValue,
          normalizedValue ? `${label} copiado: ${normalizedValue}` : undefined,
        )
      }
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      title={`Copiar ${label}`}
    >
      <Clipboard className="h-3 w-3 opacity-70" aria-hidden="true" />
      <span className="font-medium">{label}</span>
      <span>{displayValue}</span>
    </button>
  );
}

export default CopyableIdentifier;
