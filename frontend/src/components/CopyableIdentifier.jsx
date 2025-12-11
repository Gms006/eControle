import React from "react";
import { Clipboard } from "lucide-react";
import { formatCpfCnpj, normalizeIdentifier } from "@/lib/text";

function CopyableIdentifier({ label, value, onCopy, isPassword = false }) {
  // Para senhas, não aplicar formatação de CNPJ/CPF
  const normalizedValue = isPassword ? (value || "").trim() : normalizeIdentifier(value);
  const formattedDocument = isPassword ? undefined : formatCpfCnpj(value);
  const displayValue = formattedDocument || normalizedValue || "—";

  const handleClick = (e) => {
    const isCtrlClick = e.ctrlKey || e.metaKey;
    
    if (isCtrlClick) {
      // Ctrl + clique = copia sem máscara (para CNPJ/CPF sem máscara)
      onCopy(
        normalizedValue,
        normalizedValue ? `${label} copiado (sem máscara): ${normalizedValue}` : undefined,
      );
    } else {
      // Clique normal = copia com máscara (ou valor direto para senhas)
      const valueToCopy = formattedDocument || normalizedValue;
      onCopy(
        valueToCopy,
        valueToCopy ? `${label} copiado: ${valueToCopy}` : undefined,
      );
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      title={`Copiar ${label}${!isPassword ? ' (Ctrl+clique para copiar sem máscara)' : ''}`}
    >
      <Clipboard className="h-3 w-3 opacity-70" aria-hidden="true" />
      <span className="font-medium">{label}</span>
      <span>{displayValue}</span>
    </button>
  );
}

export default CopyableIdentifier;
