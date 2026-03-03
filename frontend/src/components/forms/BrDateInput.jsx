import React from "react";
import { Input } from "@/components/ui/input";
import { isValidBrDate, maskBrDate, toCanonicalIsoDate, toUiBrDate } from "@/lib/date";

export function BrDateInput({ id, value, onChange, placeholder = "dd/mm/aaaa", disabled = false }) {
  const [touched, setTouched] = React.useState(false);
  const uiValue = toUiBrDate(value) || maskBrDate(value);
  const showError = touched && uiValue.length > 0 && !isValidBrDate(uiValue);

  return (
    <div className="space-y-1">
      <Input
        id={id}
        inputMode="numeric"
        maxLength={10}
        placeholder={placeholder}
        disabled={disabled}
        value={uiValue}
        onBlur={() => setTouched(true)}
        onChange={(event) => {
          const masked = maskBrDate(event.target.value);
          const iso = toCanonicalIsoDate(masked);
          onChange?.(iso ?? masked);
        }}
        className={showError ? "border-rose-300 focus-visible:ring-rose-200" : ""}
      />
      {showError ? (
        <p className="text-xs text-rose-600">Data inválida. Use o formato dd/mm/aaaa.</p>
      ) : null}
    </div>
  );
}
