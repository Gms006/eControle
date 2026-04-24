import React from "react";
import { Chip } from "@/components/Chip";
import { normalizeText } from "@/lib/text";
import { formatStatusDisplay, resolveStatusClass } from "@/lib/status";

function StatusBadge({ status, className = "" }) {
  const normalized = normalizeText(status);
  const displayValue = formatStatusDisplay(normalized);
  const resolved = resolveStatusClass(status);
  const variant = typeof resolved === "string" ? resolved : resolved?.variant;
  const resolvedClassName = typeof resolved === "object" ? resolved?.className : "";
  return (
    <Chip variant={variant || "neutral"} className={[resolvedClassName, className].filter(Boolean).join(" ")}>
      {displayValue}
    </Chip>
  );
}

export default StatusBadge;
