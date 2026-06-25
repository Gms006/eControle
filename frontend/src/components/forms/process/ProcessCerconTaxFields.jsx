import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PROCESS_CERCON_TAX_FIELDS, TAX_STATUS_OPTION_ITEMS } from "@/hooks/useProcessForm";

export default function ProcessCerconTaxFields({ state, form, fieldClass, FieldBlock }) {
  return (
    <>
      {PROCESS_CERCON_TAX_FIELDS.map(([field, label]) => (
        <FieldBlock key={field} label={label}>
          <select
            className={fieldClass}
            value={state.cerconTaxStatusDraft[field] ?? form.extra?.[field] ?? ""}
            onChange={(e) => state.handleCerconTaxStatusChange(field, e.target.value)}
          >
            {TAX_STATUS_OPTION_ITEMS.map((status) => (
              <option key={`${field}-${status.value || "empty"}`} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          {(state.cerconTaxStatusDraft[field] ?? form.extra?.[field]) === "parcelado" ? (
            <div className="mt-2">
              <Input
                className={fieldClass}
                placeholder="x/y"
                value={state.cerconTaxInstallmentDraft[field] ?? "/"}
                onChange={(e) => state.handleCerconTaxInstallmentChange(field, e.target.value)}
              />
              <p
                className={`mt-1 text-xs ${
                  state.cerconTaxInstallmentError[field] ? "text-rose-600" : "text-slate-500"
                }`}
              >
                {state.cerconTaxInstallmentError[field] || "Use x/y. Ex.: 0/3, 1/4."}
              </p>
            </div>
          ) : null}

          {(state.cerconTaxStatusDraft[field] ?? form.extra?.[field]) === "pendente" ? (
            <div className="mt-2">
              <Textarea
                rows={2}
                className={fieldClass}
                placeholder="Observação do motivo pendente"
                value={state.cerconTaxPendingObservationDraft[field] ?? ""}
                onChange={(e) => state.handleCerconTaxPendingObservationChange(field, e.target.value)}
              />
            </div>
          ) : null}
        </FieldBlock>
      ))}
    </>
  );
}
