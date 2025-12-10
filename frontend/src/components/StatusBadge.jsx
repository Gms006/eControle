import React from "react";
import { normalizeText } from "@/lib/text";
import { resolveStatusClass } from "@/lib/status";
import Chip from "@/components/Chip";

function StatusBadge({ status }) {
  const normalized = normalizeText(status);
  const trimmed = normalized.trim();
  const displayValue =
    trimmed === "" || trimmed === "*" || trimmed === "-" || trimmed === "—" ? "—" : trimmed;
  const { variant } = resolveStatusClass(status);
  return <Chip variant={variant}>{displayValue}</Chip>;
}

export default StatusBadge;
