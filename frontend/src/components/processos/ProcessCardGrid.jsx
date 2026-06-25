import React from "react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/Chip";
import CopyableCompanyName from "@/components/CopyableCompanyName";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const maskCPF = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return "";
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const resolveCompanyName = (proc, normalizeText) => {
  const candidates = [
    proc?.empresa,
    proc?.company_name,
    proc?.company_razao_social,
    proc?.razao_social,
    proc?.nome,
    proc?.name,
  ];
  for (const candidate of candidates) {
    const text = normalizeText(candidate).trim();
    if (text) return text;
  }
  return "Sem nome";
};

const resolveDocumentDisplay = (proc, maskCNPJ, normalizeText) => {
  const cnpjCandidates = [proc?.cnpj, proc?.cnpj_empresa, proc?.company_cnpj];
  for (const cnpj of cnpjCandidates) {
    const digits = String(cnpj ?? "").replace(/\D/g, "");
    if (digits.length === 14) {
      return { label: "CNPJ", value: maskCNPJ(digits) || digits };
    }
  }

  const cpfCandidates = [proc?.cpf, proc?.company_cpf, proc?.documento];
  for (const cpf of cpfCandidates) {
    const digits = String(cpf ?? "").replace(/\D/g, "");
    if (digits.length === 11) {
      return { label: "CPF", value: maskCPF(digits) || digits };
    }
  }

  const rawDoc = normalizeText(proc?.documento).trim();
  if (rawDoc) return { label: "Documento", value: rawDoc };
  return { label: "Documento", value: "—" };
};

export default function ProcessCardGrid({
  processosOrdenados,
  resolveObsValue,
  normalizeText,
  resolveProcessId,
  formatMunicipio,
  normalizeIdentifier,
  maskCNPJ,
  formatProcessDate,
  abbreviateProcessStatus,
  resolveStatusClass,
  formatStatusDisplay,
  formatCanonicalLabel,
  getProcessKey,
  openEditProcesso,
  handleCopy,
  openObsDrawer,
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {processosOrdenados.map((proc, index) => {
        const obsValue = resolveObsValue(proc);
        const obsText = normalizeText(obsValue).trim();
        const processId = resolveProcessId(proc);
        const municipio = formatMunicipio(proc);
        const protocoloDisplay = normalizeIdentifier(proc?.protocolo) || "—";
        const companyName = resolveCompanyName(proc, normalizeText);
        const documentDisplay = resolveDocumentDisplay(proc, maskCNPJ, normalizeText);
        const dataAbertura = formatProcessDate(proc?.data_solicitacao);
        const statusRaw = normalizeText(proc?.situacao || proc?.status).trim() || "Situação";
        const statusLabel = abbreviateProcessStatus(statusRaw);
        const statusResolved = resolveStatusClass(statusRaw);
        const statusVariant = typeof statusResolved === "string" ? statusResolved : statusResolved?.variant;
        const statusClassName = typeof statusResolved === "object" ? statusResolved?.className : "";
        const operationLabel = proc.diversosOperacaoLabel || formatCanonicalLabel(proc?.operacao, "");

        return (
          <Card
            key={getProcessKey(proc, index)}
            onClick={() => openEditProcesso(processId)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openEditProcesso(processId);
              }
            }}
            className="flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold leading-tight text-slate-950">
                  <CopyableCompanyName value={companyName} onCopy={handleCopy} size="base" />
                </p>
                <p className="whitespace-nowrap text-sm text-slate-500">
                  {proc.tipoDisplay}
                  {operationLabel ? ` • ${operationLabel}` : ""}
                </p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (documentDisplay.value !== "—") {
                      handleCopy(documentDisplay.value, `${documentDisplay.label} copiado: ${documentDisplay.value}`);
                    }
                  }}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-700"
                  title={`Copiar ${documentDisplay.label}`}
                >
                  {documentDisplay.label}: {documentDisplay.value}
                </button>
              </div>
              <Chip
                variant={statusVariant || "neutral"}
                className={cn("max-w-[140px] shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold", statusClassName)}
                title={formatStatusDisplay(statusRaw)}
              >
                {statusLabel}
              </Chip>
            </div>

            <div className="mt-3 space-y-3">
              <div className="rounded-lg bg-slate-100 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-400">Protocolo</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (protocoloDisplay !== "—") handleCopy(protocoloDisplay, `Protocolo copiado: ${protocoloDisplay}`);
                    }}
                    className="font-mono font-semibold text-slate-800 transition hover:text-slate-950"
                    title="Copiar protocolo"
                  >
                    {protocoloDisplay}
                  </button>
                </div>
              </div>

              <div className="rounded-lg bg-slate-100 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-400">Data de abertura</span>
                  <span className="font-mono font-semibold text-slate-800">{dataAbertura}</span>
                </div>
              </div>

              {municipio ? (
                <div className="rounded-lg bg-slate-100 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>Município</span>
                    </span>
                    <span className="font-semibold text-slate-800">{municipio}</span>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openObsDrawer(proc);
                }}
                className="w-full rounded-lg bg-slate-100 px-3 py-3 text-left transition hover:bg-slate-200/70"
                title="Editar observação"
              >
                <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">
                  {obsText || "Nenhuma observação registrada."}
                </p>
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
