import React from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldRow, SectionCard } from "@/components/forms/DrawerFormPrimitives";
import FormSideDrawer from "@/components/ui/FormSideDrawer";
import {
  TAX_DATA_ENVIO_METHOD_OPTIONS,
  TAX_STATUS_FIELDS,
  TAX_STATUS_OPTION_ITEMS,
} from "@/hooks/useTaxForm";

const FIELD_CLASS =
  "w-full rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200";
const FIELD_BUTTON_CLASS =
  "flex w-full items-center justify-between rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-left text-sm text-slate-900 shadow-inner transition hover:bg-white focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200";

export default function TaxDrawer({ state }) {
  return (
    <FormSideDrawer
      open={state.modal.open}
      title="Editar Taxas"
      onClose={state.closeTaxModal}
      isSaving={state.isSaving}
      onSave={() => state.saveTax().catch((e) => alert(e.message))}
      saveLabel="Salvar"
      savingLabel="Salvando..."
    >
      <div className="space-y-4">
        <SectionCard title="Empresa" description="Contexto do registro de taxas">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FieldRow label="Empresa" className="md:col-span-2">
              <Input value={state.form.empresa || "—"} className={FIELD_CLASS} disabled />
            </FieldRow>

            <FieldRow label="Município">
              <Input value={state.form.municipio || "—"} className={FIELD_CLASS} disabled />
            </FieldRow>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">Data de envio</label>
              <input
                type="date"
                data-testid="tax-envio-date"
                value={state.envioDateDraft}
                onChange={(e) => state.setEnvioDateDraft(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">Método(s) de envio</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-testid="tax-envio-method-trigger"
                    className={FIELD_BUTTON_CLASS}
                  >
                    <span className="truncate">
                      {state.envioMethodsDraft.length > 0
                        ? state.envioMethodsDraft.join("; ")
                        : "Selecionar método"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="z-[2147483647] w-72">
                  <DropdownMenuLabel>Métodos permitidos</DropdownMenuLabel>
                  {TAX_DATA_ENVIO_METHOD_OPTIONS.map((metodo) => (
                    <DropdownMenuCheckboxItem
                      key={metodo}
                      checked={state.envioMethodsDraft.includes(metodo)}
                      onCheckedChange={() => state.toggleEnvioMetodo(metodo)}
                      onSelect={(event) => event.preventDefault()}
                    >
                      {metodo}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Taxas" description="Situação por tipo">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {TAX_STATUS_FIELDS.map(([key, label]) => (
              <FieldRow key={key} label={label}>
                <select
                  data-testid={`tax-status-${key}`}
                  className={FIELD_CLASS}
                  value={state.statusModeDraft[key] ?? state.form[key] ?? ""}
                  onChange={(e) => state.handleStatusChange(key, e.target.value)}
                >
                  {TAX_STATUS_OPTION_ITEMS.map((status) => (
                    <option key={status.value || "empty"} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>

                {(state.statusModeDraft[key] ?? state.form[key]) === "parcelado" ? (
                  <div className="mt-2">
                    <Input
                      data-testid={`tax-installment-${key}`}
                      className={FIELD_CLASS}
                      placeholder="x/y"
                      value={state.installmentDraft[key] ?? "/"}
                      onChange={(e) => state.handleInstallmentChange(key, e.target.value)}
                    />
                    <p
                      className={`mt-1 text-xs ${
                        state.installmentError[key] ? "text-rose-600" : "text-slate-500"
                      }`}
                    >
                      {state.installmentError[key] || "Use x/y. Ex.: 0/3, 1/4."}
                    </p>
                  </div>
                ) : null}

                {(state.statusModeDraft[key] ?? state.form[key]) === "em_aberto" ? (
                  <div className="mt-2">
                    <Input
                      data-testid={`tax-open-years-${key}`}
                      className={FIELD_CLASS}
                      placeholder="Anos em aberto (AAAA, AAAA)"
                      value={state.openYearsDraft[key] ?? ""}
                      onChange={(e) => state.handleOpenYearsChange(key, e.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-500">Ex.: 2023, 2024, 2025.</p>
                  </div>
                ) : null}

                {(state.statusModeDraft[key] ?? state.form[key]) === "pendente" ? (
                  <div className="mt-2">
                    <Textarea
                      data-testid={`tax-pendente-obs-${key}`}
                      rows={2}
                      className={FIELD_CLASS}
                      placeholder="Observação do motivo pendente"
                      value={state.pendingObservationDraft[key] ?? ""}
                      onChange={(e) => state.handlePendingObservationChange(key, e.target.value)}
                    />
                  </div>
                ) : null}
              </FieldRow>
            ))}

            <FieldRow label="Vencimento TPI (dd/mm)">
              <Input
                className={FIELD_CLASS}
                value={state.form.vencimento_tpi}
                onChange={(e) =>
                  state.setForm((prev) => ({ ...prev, vencimento_tpi: e.target.value }))
                }
                placeholder="dd/mm"
              />
            </FieldRow>
          </div>
        </SectionCard>
      </div>
    </FormSideDrawer>
  );
}