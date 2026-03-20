import React from "react";
import { Chip } from "@/components/Chip";
import { normalizeText } from "@/lib/text";
import { formatStatusDisplay, resolveStatusClass } from "@/lib/status";

function StatusBadge({ status }) {
  const normalized = normalizeText(status);
  const displayValue = formatStatusDisplay(normalized);
  const resolved = resolveStatusClass(status);
  const variant = typeof resolved === "string" ? resolved : resolved?.variant;
  const className = typeof resolved === "object" ? resolved?.className : undefined;
  return (
    <Chip variant={variant || "neutral"} className={className}>
      {displayValue}
    </Chip>
  );
}

export default StatusBadge;
