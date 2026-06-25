import React from "react";
import { FileText } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { normalizeText } from "@/lib/text";

export const renderProcessStatus = (value) => {
  const text = normalizeText(value).trim();
  if (!text) return "—";
  return <StatusBadge status={text} />;
};

export const renderProcessObsSnippet = (value) => {
  const text = normalizeText(value).trim();
  if (!text) return "—";
  const snippet = text.length > 80 ? `${text.slice(0, 77)}...` : text;
  return (
    <div className="inline-flex items-center gap-2 text-xs text-slate-600" title={text}>
      <FileText className="h-3.5 w-3.5 text-slate-400" />
      <span className="line-clamp-1 text-left leading-snug">{snippet}</span>
    </div>
  );
};
