import React from "react";
import { Input } from "@/components/ui/input";
import ProcessCompanyField from "@/components/forms/process/ProcessCompanyField";

export default function ProcessDadosTab({
  modal,
  form,
  setForm,
  state,
  companyRazaoSocial,
  fieldClass,
  FieldBlock,
  SectionHeader,
  processTypeOptions,
  update,
}) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Dados" subtitle="Dados principais e status do processo" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FieldBlock label="Empresa" required className="md:col-span-2">
          <ProcessCompanyField
            modalMode={modal.mode}
            processType={form.process_type}
            form={form}
            setForm={setForm}
            companyOptions={state.companyOptions}
            companyRazaoSocial={companyRazaoSocial}
            fieldClass={fieldClass}
            FieldBlock={FieldBlock}
          />
        </FieldBlock>

        <FieldBlock label="Tipo">
          <select
            className={fieldClass}
            value={form.process_type}
            onChange={(e) => {
              const nextType = e.target.value;
              if (nextType !== "CERCON") {
                state.handleCerconTaxStatusChange("taxa_bombeiros_sync_status", "");
                state.handleCerconTaxStatusChange("tpi_sync_status", "");
              }
              setForm((prev) => {
                const keepUnregistered = prev.empresa_nao_cadastrada && nextType === "DIVERSOS";
                return {
                  ...prev,
                  process_type: nextType,
                  empresa_nao_cadastrada: keepUnregistered,
                  company_cnpj: keepUnregistered ? prev.company_cnpj : "",
                  company_razao_social: keepUnregistered ? prev.company_razao_social : "",
                };
              });
            }}
          >
            {processTypeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </FieldBlock>

        <FieldBlock label="Protocolo" required>
          <Input className={fieldClass} value={form.protocolo} onChange={(e) => update({ protocolo: e.target.value })} />
        </FieldBlock>

        <FieldBlock label="Data solicitação">
          <input
            type="date"
            value={form.data_solicitacao || ""}
            onChange={(e) => update({ data_solicitacao: e.target.value })}
            className={fieldClass}
          />
        </FieldBlock>

        <FieldBlock label="Situação">
          <select className={fieldClass} value={form.situacao} onChange={(e) => update({ situacao: e.target.value })}>
            <option value="">Selecione</option>
            {state.processSituacoes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </FieldBlock>
      </div>
    </div>
  );
}
