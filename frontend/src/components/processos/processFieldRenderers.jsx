import React from "react";
import { Chip } from "@/components/Chip";
import { normalizeText } from "@/lib/text";
import { renderProcessStatus } from "@/components/processos/processRenderers";

export const renderProcessFieldValue = (field) => {
  if (field.isStatus) return renderProcessStatus(field.rawValue);
  const text = normalizeText(field.value).trim();
  if (!text || text === "—") return "—";
  return (
    <Chip variant="neutral" className="border-slate-200 bg-slate-100 text-[11px] text-slate-700">
      {text}
    </Chip>
  );
};
