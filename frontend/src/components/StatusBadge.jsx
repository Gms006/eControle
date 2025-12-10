import React from "react";
import { Chip } from "@/components/Chip";
import { normalizeText } from "@/lib/text";
import { resolveStatusClass } from "@/lib/status";

function StatusBadge({ status }) {
  const normalized = normalizeText(status);
  const trimmed = normalized.trim();
  const displayValue =
    trimmed === "" || trimmed === "*" || trimmed === "-" || trimmed === "—" ? "—" : trimmed;
  const { variant, className } = resolveStatusClass(status);
  return (
    <Chip variant={variant} className={className}>
      {displayValue}
    </Chip>
  );
}

export default StatusBadge;
