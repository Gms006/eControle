import React from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SecondaryButton } from "@/components/forms/DrawerFormPrimitives";
import { maskCnpj, maskCpf, normalizeDigits } from "@/lib/masks";
import { formatCanonicalLabel } from "@/lib/text";
import {
  PROCESS_CERCON_TAX_FIELDS,
  TAX_STATUS_OPTION_ITEMS,
} from "@/hooks/useProcessForm";

const FIELD_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[13px] text-slate-900 focus:border-[#1a4a7a] focus:outline-none focus:ring-2 focus:ring-[#1a4a7a]/15";

const LABEL_CLASS = "text-xs font-medium text-slate-500";

const AMBIENTAL_OPERACAO_OPTIONS = [
  { value: "dispensa_ambiental", label: "Dispensa Ambiental" },
  { value: "licenca_ambiental", label: "Licença Ambiental" },
];

const PROCESS_TYPE_OPTIONS = [
  { value: "DIVERSOS", label: "Diversos" },
  { value: "FUNCIONAMENTO", label: "Funcionamento" },
  { value: "CERCON", label: "CERCON/Bombeiro" },
  { value: "USO_DO_SOLO", label: "Uso do Solo" },
  { value: "LICENCA_AMBIENTAL", label: "Licença Ambiental" },
  { value: "ALVARA_SANITARIO", label: "Sanitário" },
];

const TAB_DEFS = [
  { key: "dados", label: "Dados" },
  { key: "detalhes", label: "Detalhes" },
  { key: "observacao", label: "Observação" },
];

function FieldBlock({ label, required = false, className = "", children }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <p className={LABEL_CLASS}>
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </p>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

export default function ProcessDrawer({ state }) {
  const { modal, form, setForm } = state;
  const [activeTab, setActiveTab] = React.useState("dados");

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const maskDocument = (value) => {
    const digits = normalizeDigits(value || "");
    if (digits.length <= 11) return maskCpf(digits);
    return maskCnpj(digits);
  };

  const selectedCompany = state.companyOptions.find(
    (item) => String(item.id) === String(form.company_id),
  );
  const companyRazaoSocial = String(
    form.company_razao_social || selectedCompany?.razao_social || "",
  ).trim();
  const statusLabel =
    state.processSituacoes.find((item) => item.value === form.situacao)?.label ||
    formatCanonicalLabel(form.situacao, "Ativo");
  const municipioLabel = formatCanonicalLabel(form.municipio, "—");
  const servicoLabel =
    state.processServicos.find((item) => item.value === form.extra?.servico)?.label ||
    formatCanonicalLabel(form.extra?.servico, "—");
  const notificacaoLabel =
    state.processNotificacoes.find((item) => item.value === form.extra?.notificacao)?.label ||
    formatCanonicalLabel(form.extra?.notificacao, "—");

  const companyLabel = formatCanonicalLabel(companyRazaoSocial, "Empresa");

  const companyInitials =
    companyLabel
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "EM";

  const save = () => state.saveProcess().catch((e) => alert(e.message));
  const remove = () => state.deleteProcess().catch((e) => alert(e.message));

  React.useEffect(() => {
    if (!modal.open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [modal.open]);

  React.useEffect(() => {
    if (!modal.open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        state.closeProcessModal?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal.open, state.closeProcessModal]);

  const renderCompanyField = () => {
    if (modal.mode === "create" && form.process_type === "DIVERSOS") {
      return (
        <>
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
          {form.empresa_nao_cadastrada ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldBlock label="CNPJ" required>
                <Input
                  className={FIELD_CLASS}
                  value={maskCnpj(form.company_cnpj)}
                  onChange={(e) =>
                    update({ company_cnpj: normalizeDigits(e.target.value).slice(0, 14) })
                  }
                />
              </FieldBlock>
              <FieldBlock label="Razão Social" required>
                <Input
                  className={FIELD_CLASS}
                  value={form.company_razao_social}
                  onChange={(e) => update({ company_razao_social: e.target.value })}
                />
              </FieldBlock>
            </div>
          ) : (
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
          )}
        </>
      );
    }

    if (modal.mode === "create") {
      return (
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
      );
    }

    return (
      <Input
        value={companyRazaoSocial || form.company_id || "Empresa não cadastrada"}
        className={FIELD_CLASS}
        disabled
      />
    );
  };

  if (!modal.open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]">
      <button type="button" aria-label="Fechar modal" className="absolute inset-0" onClick={state.closeProcessModal} />
      <div className="relative z-10 flex w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" style={{ maxWidth: '860px', height: 'min(700px, calc(100dvh - 2rem))', minHeight: '560px' }}>
        <aside className="flex shrink-0 flex-col p-5" style={{ width: '220px', background: '#0f2035' }}>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md text-sm font-semibold" style={{ background: '#1e4d7a', color: '#cfe5fa' }}>
                {companyInitials}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide" style={{ color: '#6b8aaa' }}>Razão Social</p>
                <p className="truncate text-sm font-medium" style={{ color: '#e2ecf6' }}>{companyLabel}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wide" style={{ color: '#6b8aaa' }}># Protocolo</p>
                <p className="truncate text-xs" style={{ color: '#a8c0da' }}>{form.protocolo || "—"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium" style={{ background: '#1c3d28', color: '#5eba82' }}>
                {statusLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Situação", value: statusLabel || "—" },
                { label: "Município", value: municipioLabel || "—" },
                { label: "Serviço", value: servicoLabel || "—" },
                { label: "Notificação", value: notificacaoLabel || "—" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: '#6b8aaa' }}>{item.label}</p>
                  <p className="mt-1 line-clamp-2 text-xs" style={{ color: '#e2ecf6' }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {modal.mode === "edit" ? (
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition"
                style={{ border: '1px solid rgba(220,70,70,0.4)', color: '#e57373' }}
                disabled={state.isDeleting}
                onClick={remove}
              >
                <Trash2 className="h-4 w-4" />
                {state.isDeleting ? "Excluindo..." : "Excluir processo"}
              </button>
            ) : null}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-white">
          <header className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  CADASTRO › {companyLabel} › PROCESSO
                </p>
                <p className="mt-1 text-[18px] font-medium text-slate-900">
                  {modal.mode === "edit" ? "Editar Processo" : "Novo Processo"}
                </p>
              </div>
              <button
                type="button"
                onClick={state.closeProcessModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex items-end gap-1">
              {TAB_DEFS.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`border-b-2 px-2.5 py-2 text-sm transition ${
                      active
                        ? "border-[#1a4a7a] font-medium text-[#1a4a7a]"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {activeTab === "dados" ? (
              <div className="space-y-3">
                <SectionHeader title="Dados" subtitle="Dados principais e status do processo" />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FieldBlock label="Empresa" required className="md:col-span-2">
                    {renderCompanyField()}
                  </FieldBlock>

                  <FieldBlock label="Tipo">
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
                      {PROCESS_TYPE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </FieldBlock>

                  <FieldBlock label="Protocolo" required>
                    <Input
                      className={FIELD_CLASS}
                      value={form.protocolo}
                      onChange={(e) => update({ protocolo: e.target.value })}
                    />
                  </FieldBlock>

                  <FieldBlock label="Data solicitação">
                    <input
                      type="date"
                      value={form.data_solicitacao || ""}
                      onChange={(e) => update({ data_solicitacao: e.target.value })}
                      className={FIELD_CLASS}
                    />
                  </FieldBlock>

                  <FieldBlock label="Situação">
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
                  </FieldBlock>
                </div>
              </div>
            ) : null}

            {activeTab === "detalhes" ? (
              <div className="space-y-3">
                <SectionHeader title="Detalhes" subtitle="Campos complementares por tipo de processo" />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FieldBlock label="Município">
                    <Input
                      className={FIELD_CLASS}
                      value={form.municipio}
                      onChange={(e) => update({ municipio: e.target.value })}
                    />
                  </FieldBlock>

                  {form.process_type === "DIVERSOS" ? (
                    <>
                      <FieldBlock label="Operação" required>
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
                      </FieldBlock>

                      <FieldBlock label="Órgão" required>
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
                      </FieldBlock>
                    </>
                  ) : null}

                  {form.process_type === "FUNCIONAMENTO" ? (
                    <FieldBlock label="Alvará">
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
                    </FieldBlock>
                  ) : null}

                  {form.process_type === "CERCON" ? (
                    <>
                      <FieldBlock label="Área (m²)">
                        <Input
                          className={FIELD_CLASS}
                          value={form.extra?.area_m2 || ""}
                          onChange={(e) =>
                            state.updateExtra("area_m2", String(e.target.value || "").replace(/[^\d.,]/g, ""))
                          }
                        />
                      </FieldBlock>

                      {PROCESS_CERCON_TAX_FIELDS.map(([field, label]) => (
                        <FieldBlock key={field} label={label}>
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
                        </FieldBlock>
                      ))}

                      <FieldBlock label="Projeto aprovado">
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
                      </FieldBlock>
                    </>
                  ) : null}

                  {form.process_type === "USO_DO_SOLO" ? (
                    <FieldBlock label="Inscrição imobiliária">
                      <Input
                        className={FIELD_CLASS}
                        value={form.extra?.inscricao_imobiliaria || ""}
                        onChange={(e) => state.updateExtra("inscricao_imobiliaria", e.target.value)}
                      />
                    </FieldBlock>
                  ) : null}

                  {form.process_type === "ALVARA_SANITARIO" ? (
                    <>
                      <FieldBlock label="Serviço">
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
                      </FieldBlock>

                      <FieldBlock label="Notificação">
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
                      </FieldBlock>
                    </>
                  ) : null}

                  {form.process_type === "LICENCA_AMBIENTAL" ? (
                    <FieldBlock label="Operação" required>
                      <select
                        className={FIELD_CLASS}
                        value={form.extra?.operacao || ""}
                        onChange={(e) => state.updateExtra("operacao", e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {AMBIENTAL_OPERACAO_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </FieldBlock>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "observacao" ? (
              <div className="space-y-3">
                <SectionHeader title="Observação" subtitle="Notas internas do processo" />
                <FieldBlock label="Observação">
                  <Textarea
                    rows={8}
                    data-testid="process-obs"
                    value={form.obs}
                    onChange={(e) => update({ obs: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </FieldBlock>
              </div>
            ) : null}
          </div>

          <footer className="border-t border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-end gap-2">
              <SecondaryButton type="button" onClick={state.closeProcessModal}>
                Cancelar
              </SecondaryButton>
              <button
                type="button"
                className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={state.isSaving}
                onClick={save}
              >
                {state.isSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>,
    document.body,
  );
}
