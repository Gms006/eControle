import React from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldRow, SectionCard, SecondaryButton } from "@/components/forms/DrawerFormPrimitives";
import FormSideDrawer from "@/components/ui/FormSideDrawer";
import { maskCnpj, maskCpf, normalizeDigits } from "@/lib/masks";
import {
  PROCESS_CERCON_TAX_FIELDS,
  TAX_STATUS_OPTION_ITEMS,
} from "@/hooks/useProcessForm";

const FIELD_CLASS =
  "w-full rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200";

export default function ProcessDrawer({ state }) {
  const { modal, form, setForm } = state;

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const maskDocument = (value) => {
    const digits = normalizeDigits(value || "");
    if (digits.length <= 11) return maskCpf(digits);
    return maskCnpj(digits);
  };

  return (
    <FormSideDrawer
      open={modal.open}
      title={modal.mode === "edit" ? "Editar Processo" : "Novo Processo"}
      onClose={state.closeProcessModal}
      isSaving={state.isSaving}
      onSave={() => state.saveProcess().catch((e) => alert(e.message))}
      footerStart={
        modal.mode === "edit" ? (
          <SecondaryButton
            type="button"
            className="border-rose-200 text-rose-700 hover:bg-rose-50"
            disabled={state.isDeleting}
            onClick={() => state.deleteProcess().catch((e) => alert(e.message))}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {state.isDeleting ? "Excluindo..." : "Excluir"}
          </SecondaryButton>
        ) : null
      }
    >
      <div className="space-y-4">
        <SectionCard title="Dados do Processo" description="Dados principais e status">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldRow label="Empresa" className="md:col-span-2" required>
              {modal.mode === "create" && form.process_type === "DIVERSOS" ? (
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.empresa_nao_cadastrada === true}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        empresa_nao_cadastrada: e.target.checked,
                        company_id: e.target.checked ? "" : prev.company_id,
                        company_cnpj: e.target.checked ? prev.company_cnpj : "",
                        company_razao_social: e.target.checked ? prev.company_razao_social : "",
                      }))
                    }
                  />
                  Empresa não cadastrada
                </label>
              ) : null}

              {modal.mode === "create" && form.empresa_nao_cadastrada ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FieldRow label="CNPJ" required>
                    <Input
                      className={FIELD_CLASS}
                      value={maskCnpj(form.company_cnpj)}
                      onChange={(e) =>
                        update({ company_cnpj: normalizeDigits(e.target.value).slice(0, 14) })
                      }
                    />
                  </FieldRow>

                  <FieldRow label="Razão Social" required>
                    <Input
                      className={FIELD_CLASS}
                      value={form.company_razao_social}
                      onChange={(e) => update({ company_razao_social: e.target.value })}
                    />
                  </FieldRow>
                </div>
              ) : modal.mode === "create" ? (
                <select
                  className={FIELD_CLASS}
                  value={form.company_id}
                  onChange={(e) => {
                    const companyId = e.target.value;
                    const selected = state.companyOptions.find((item) => item.id === companyId);
                    setForm((prev) => ({
                      ...prev,
                      company_id: companyId,
                      municipio: selected?.municipio || prev.municipio,
                    }));
                  }}
                >
                  <option value="">Selecione</option>
                  {state.companyOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {(item.razao_social || "Empresa")} - {maskDocument(item.cnpj || item.company_cpf)}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={form.company_id || form.company_razao_social || "Empresa não cadastrada"}
                  className={FIELD_CLASS}
                  disabled
                />
              )}
            </FieldRow>

            <FieldRow label="Tipo">
              <select
                className={FIELD_CLASS}
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
                <option value="DIVERSOS">Diversos</option>
                <option value="FUNCIONAMENTO">Funcionamento</option>
                <option value="CERCON">CERCON/Bombeiro</option>
                <option value="USO_DO_SOLO">Uso do Solo</option>
                <option value="ALVARA_SANITARIO">Sanitário</option>
              </select>
            </FieldRow>

            <FieldRow label="Protocolo" required>
              <Input
                className={FIELD_CLASS}
                value={form.protocolo}
                onChange={(e) => update({ protocolo: e.target.value })}
              />
            </FieldRow>

            <FieldRow label="Data solicitação">
              <input
                type="date"
                value={form.data_solicitacao || ""}
                onChange={(e) => update({ data_solicitacao: e.target.value })}
                className={FIELD_CLASS}
              />
            </FieldRow>

            <FieldRow label="Situação">
              <select
                className={FIELD_CLASS}
                value={form.situacao}
                onChange={(e) => update({ situacao: e.target.value })}
              >
                <option value="">Selecione</option>
                {state.processSituacoes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </FieldRow>
          </div>
        </SectionCard>

        <SectionCard title="Detalhes" description="Campos por tipo de processo">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldRow label="Município">
              <Input
                className={FIELD_CLASS}
                value={form.municipio}
                onChange={(e) => update({ municipio: e.target.value })}
              />
            </FieldRow>

            {form.process_type === "DIVERSOS" ? (
              <>
                <FieldRow label="Operação" required>
                  <select
                    className={FIELD_CLASS}
                    value={form.extra?.operacao || ""}
                    onChange={(e) => state.updateExtra("operacao", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {state.processOperacoes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Órgão" required>
                  <select
                    className={FIELD_CLASS}
                    value={form.extra?.orgao || ""}
                    onChange={(e) => state.updateExtra("orgao", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {state.processOrgaos.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </FieldRow>
              </>
            ) : null}

            {form.process_type === "FUNCIONAMENTO" ? (
              <FieldRow label="Alvará">
                <select
                  className={FIELD_CLASS}
                  value={form.extra?.alvara || ""}
                  onChange={(e) => state.updateExtra("alvara", e.target.value)}
                >
                  <option value="">Selecione</option>
                  {state.processAlvaras.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </FieldRow>
            ) : null}

            {form.process_type === "CERCON" ? (
              <>
                <FieldRow label="Área (m²)">
                  <Input
                    className={FIELD_CLASS}
                    value={form.extra?.area_m2 || ""}
                    onChange={(e) =>
                      state.updateExtra("area_m2", String(e.target.value || "").replace(/[^\d.,]/g, ""))
                    }
                  />
                </FieldRow>

                {PROCESS_CERCON_TAX_FIELDS.map(([field, label]) => (
                  <FieldRow key={field} label={label}>
                    <select
                      className={FIELD_CLASS}
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
                          className={FIELD_CLASS}
                          placeholder="x/y"
                          value={state.cerconTaxInstallmentDraft[field] ?? "/"}
                          onChange={(e) =>
                            state.handleCerconTaxInstallmentChange(field, e.target.value)
                          }
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
                          className={FIELD_CLASS}
                          placeholder="Observação do motivo pendente"
                          value={state.cerconTaxPendingObservationDraft[field] ?? ""}
                          onChange={(e) =>
                            state.handleCerconTaxPendingObservationChange(field, e.target.value)
                          }
                        />
                      </div>
                    ) : null}
                  </FieldRow>
                ))}

                <FieldRow label="Projeto aprovado">
                  <div className="space-y-2">
                    <Input
                      className={FIELD_CLASS}
                      value={form.extra?.projeto_aprovado || ""}
                      onChange={(e) => state.updateExtra("projeto_aprovado", e.target.value)}
                    />
                    <div className="flex gap-2">
                      <SecondaryButton
                        type="button"
                        size="sm"
                        onClick={() => state.updateExtra("projeto_aprovado", "nao_possui")}
                      >
                        Não possui
                      </SecondaryButton>
                      <SecondaryButton
                        type="button"
                        size="sm"
                        onClick={() => state.updateExtra("projeto_aprovado", "nao_precisa")}
                      >
                        Não precisa
                      </SecondaryButton>
                    </div>
                  </div>
                </FieldRow>
              </>
            ) : null}

            {form.process_type === "USO_DO_SOLO" ? (
              <FieldRow label="Inscrição imobiliária">
                <Input
                  className={FIELD_CLASS}
                  value={form.extra?.inscricao_imobiliaria || ""}
                  onChange={(e) => state.updateExtra("inscricao_imobiliaria", e.target.value)}
                />
              </FieldRow>
            ) : null}

            {form.process_type === "ALVARA_SANITARIO" ? (
              <>
                <FieldRow label="Serviço">
                  <select
                    className={FIELD_CLASS}
                    value={form.extra?.servico || ""}
                    onChange={(e) => state.updateExtra("servico", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {state.processServicos.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Notificação">
                  <select
                    className={FIELD_CLASS}
                    value={form.extra?.notificacao || ""}
                    onChange={(e) => state.updateExtra("notificacao", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {state.processNotificacoes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </FieldRow>
              </>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Observação" description="Notas internas do processo">
          <FieldRow label="Observação">
            <Textarea
              rows={5}
              value={form.obs}
              onChange={(e) => update({ obs: e.target.value })}
            />
          </FieldRow>
        </SectionCard>
      </div>
    </FormSideDrawer>
  );
}
