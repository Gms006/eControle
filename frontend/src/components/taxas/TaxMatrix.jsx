import React from "react";

export default function TaxMatrix({
  taxasVisiveisOrdenadas,
  viewMode,
  emptyStateText,
  resolveTaxaKey,
  TaxPrototypeCard,
  handleCopy,
  openEditTaxa,
  TAX_LINE_ITEMS,
  MatrixCompanyCell,
  getDisplayStatusForField,
  MatrixCell,
}) {
  if (taxasVisiveisOrdenadas.length === 0) {
    return <div className="px-4 py-10 text-center text-sm text-slate-500">{emptyStateText}</div>;
  }

  if (viewMode === "cards") {
    return (
      <div className="grid gap-4 px-4 py-4 md:grid-cols-2 xl:grid-cols-4">
        {taxasVisiveisOrdenadas.map((taxa, index) => (
          <TaxPrototypeCard
            key={resolveTaxaKey(taxa, index)}
            taxa={taxa}
            handleCopy={handleCopy}
            onEdit={() => openEditTaxa(taxa)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] border-collapse">
        <thead className="bg-slate-50">
          <tr>
            <th className="w-[420px] border-b border-slate-200 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Empresa
            </th>
            {TAX_LINE_ITEMS.map((item) => (
              <th
                key={`head-${item.key}`}
                className="border-b border-slate-200 px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400"
              >
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {taxasVisiveisOrdenadas.map((taxa, index) => {
            const taxaKey = resolveTaxaKey(taxa, index);
            return (
              <tr key={taxaKey} className="align-top hover:bg-slate-50/70">
                <td className="border-b border-slate-200 px-4 py-4">
                  <MatrixCompanyCell taxa={taxa} handleCopy={handleCopy} onEdit={() => openEditTaxa(taxa)} />
                </td>
                {TAX_LINE_ITEMS.map((item) => {
                  const rawStatus = taxa?.[item.key];
                  const statusDisplay = getDisplayStatusForField(taxa, item.key);
                  return (
                    <td key={`${taxaKey}-${item.key}`} className="border-b border-slate-200 px-3 py-4 text-center">
                      <MatrixCell
                        status={rawStatus}
                        statusDisplay={statusDisplay}
                        vencimento={item.getVencimento ? item.getVencimento(taxa) : null}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
