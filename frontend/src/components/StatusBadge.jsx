import React from "react";
import { Chip } from "@/components/Chip";
import { normalizeText } from "@/lib/text";
import { formatStatusDisplay, resolveStatusClass } from "@/lib/status";

function StatusBadge({ status }) {
  const normalized = normalizeText(status);
  const displayValue = formatStatusDisplay(normalized);
  const { variant, className } = resolveStatusClass(status);
  return (
    <Chip variant={variant} className={className}>
      {displayValue}
    </Chip>
  );
}

export default StatusBadge;
