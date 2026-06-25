import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import StatusBadge from "@/components/StatusBadge";

export default function LicenceMatrix({
  matrixViewMode,
  MATRIX_TIPOS,
  TIPOS,
  empresasMatriz,
  matrizCards,
  setDrawerItem,
  enqueueToast,
  formatMatrixStatus,
  formatStatusWithDate,
}) {
  if (matrixViewMode === "table") {
    return (
      <Card className="ec-licence-matrix-card">
        <CardContent className="p-5">
          <div className="ec-licence-matrix-head">
            <small>Matriz</small>
            <h3>Licenças por empresa</h3>
          </div>
          <div className="ec-licence-matrix-wrap">
            <ScrollArea className="h-[calc(100dvh-24rem)] w-full">
              <table className="ec-licence-matrix-table">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr>
                    <th>Empresa</th>
                    <th>Município</th>
                    {MATRIX_TIPOS.map((tipo) => <th key={tipo.key}>{tipo.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {empresasMatriz.map((emp) => (
                    <tr key={emp.key}>
                      <td className="ec-licence-matrix-company">
                        <div className="flex items-center gap-2">
                          <span>{emp.empresa}</span>
                          {emp.sem_vinculo ? <span className="ec-licence-matrix-tag">Sem vínculo</span> : null}
                        </div>
                      </td>
                      <td>{emp.municipio || "—"}</td>
                      {MATRIX_TIPOS.map((tipo) => {
                        const cell = emp.byTipo[tipo.key];
                        return (
                          <td key={`${emp.key}-${tipo.key}`}>
                            {cell ? (
                              <button
                                type="button"
                                className="ec-licence-matrix-status"
                                onClick={() => setDrawerItem(cell)}
                              >
                                <StatusBadge status={formatMatrixStatus(cell)} className="ec-chip-square" />
                              </button>
                            ) : (
                              <span className="ec-licence-matrix-empty">Sem vínculo</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {matrizCards.map((empresa) => (
        <Card key={empresa.key} className="overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md">
          <CardContent className="space-y-3 p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-900">{empresa.empresa}</p>{empresa.sem_vinculo ? <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">Sem vínculo</span> : null}</div>
              <p className="text-xs text-slate-500">{empresa.cnpj || "—"} {empresa.municipio ? `• ${empresa.municipio}` : ""}</p>
            </div>
            <div className="grid gap-2">
              {TIPOS.map((tipo) => {
                const item = empresa.byTipo[tipo.key];
                return (
                  <button key={`${empresa.key}-${tipo.key}`} type="button" className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-left transition hover:border-slate-300 hover:bg-white" onClick={() => item ? setDrawerItem(item) : enqueueToast?.("Sem registro para edição neste tipo.")}>
                    <span className="text-xs font-medium text-slate-600">{tipo.label}</span>
                    {item ? <StatusBadge status={formatStatusWithDate(item)} /> : <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">Sem vínculo</span>}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
