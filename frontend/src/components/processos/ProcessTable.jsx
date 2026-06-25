import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown, Clipboard, PencilLine } from "lucide-react";

export default function ProcessTable({
  processosOrdenados,
  TABLE_COLUMNS,
  sortField,
  sortDir,
  handleSortClick,
  formatMunicipio,
  resolveObsValue,
  maskCNPJ,
  getPriorityTypeFields,
  getProcessKey,
  normalizeText,
  normalizeIdentifier,
  formatProcessDate,
  renderStatus,
  Chip,
  openDetailsDrawer,
  openEditProcesso,
  resolveProcessId,
  openObsDrawer,
  renderObsSnippet,
  handleCopy,
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div className="max-h-[calc(100vh-280px)] overflow-auto overflow-x-auto">
        <Table className="min-w-[1180px]">
          <TableHeader className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
            <TableRow>
              {TABLE_COLUMNS.map((column) => {
                const isSortable = column.id !== "detalhes" && column.id !== "obs";
                const isActive = sortField === column.id;
                const icon = !isActive ? (
                  <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                ) : sortDir === "asc" ? (
                  <ArrowUp className="h-3.5 w-3.5 text-brand-navy" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5 text-brand-navy" />
                );
                return (
                  <TableHead
                    key={column.id}
                    className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={() => handleSortClick(column.id)}
                        className="flex w-full items-center gap-2 text-left text-slate-700 transition hover:text-slate-900"
                      >
                        <span className="cursor-pointer select-none">{column.label}</span>
                        {icon}
                      </button>
                    ) : (
                      <span>{column.label}</span>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {processosOrdenados.map((proc, index) => {
              const municipio = formatMunicipio(proc);
              const obsValue = resolveObsValue(proc);
              const maskedCnpj = maskCNPJ(proc?.cnpj);
              const detailChips = getPriorityTypeFields(proc, 3);
              return (
                <TableRow
                  key={getProcessKey(proc, index)}
                  className="border-b border-slate-100 hover:bg-slate-50/60"
                >
                  {TABLE_COLUMNS.map((column) => {
                    let content = normalizeText(proc?.[column.id]).trim() || "—";
                    if (column.id === "tipoDisplay") {
                      content = proc.tipoDisplay;
                    } else if (column.id === "empresa") {
                      content = (
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold leading-tight text-slate-800">
                            {proc?.empresa || "—"}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const value = maskCNPJ(proc?.cnpj);
                              if (value && value !== "—") handleCopy(value, `CNPJ copiado: ${value}`);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-navy transition hover:text-brand-navy-700"
                          >
                            {maskedCnpj || "—"}
                            <Clipboard className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                      );
                    } else if (column.id === "protocolo") {
                      content = normalizeIdentifier(proc?.protocolo) || "—";
                    } else if (column.id === "data_solicitacao") {
                      content = formatProcessDate(proc?.data_solicitacao);
                    } else if (column.id === "municipio") {
                      content = municipio || "—";
                    } else if (column.id === "situacao") {
                      content = renderStatus(proc?.situacao || proc?.status);
                    } else if (column.id === "detalhes") {
                      content = (
                        <div className="flex min-w-[260px] flex-wrap items-center gap-2">
                          {detailChips.length > 0 ? (
                            detailChips.map((field) => (
                              <Chip key={field.key} variant="neutral" className="border-slate-200 bg-slate-100 text-[11px] text-slate-700">
                                {field.label}: {field.value}
                              </Chip>
                            ))
                          ) : (
                            <span className="text-xs text-slate-500">Sem campos do tipo.</span>
                          )}
                          <button
                            type="button"
                            onClick={() => openDetailsDrawer(proc)}
                            className="text-[11px] font-semibold text-brand-navy underline-offset-2 hover:underline"
                          >
                            Ver todos
                          </button>
                        </div>
                      );
                    } else if (column.id === "obs") {
                      content = (
                        <div className="flex max-w-xs items-start gap-2">
                          <button
                            type="button"
                            onClick={() => openEditProcesso(resolveProcessId(proc))}
                            className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                            title="Editar processo"
                          >
                            <PencilLine className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => openObsDrawer(proc)}
                            className="inline-flex min-w-0 flex-1 items-start gap-2 text-left text-slate-700 transition-colors hover:text-slate-900"
                          >
                            {renderObsSnippet(obsValue)}
                          </button>
                        </div>
                      );
                    }
                    return (
                      <TableCell key={column.id} className="min-w-[140px] align-top px-4 py-3 text-xs text-slate-700">
                        {content}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
