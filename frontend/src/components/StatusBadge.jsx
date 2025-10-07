import React from "react";
import InlineBadge from "@/components/InlineBadge";
import { normalizeText } from "@/lib/text";
import { resolveStatusClass } from "@/lib/status";

function StatusBadge({ status }) {
  const normalized = normalizeText(status);
  const trimmed = normalized.trim();
  const displayValue =
    trimmed === "" || trimmed === "*" || trimmed === "-" || trimmed === "—" ? "—" : trimmed;
  const { variant, className } = resolveStatusClass(status);
  return (
    <InlineBadge variant={variant} className={className}>
      {displayValue}
    </InlineBadge>
  );
}

export default StatusBadge;
