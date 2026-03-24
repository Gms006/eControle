import React from "react";
import { CircleX, ExternalLink, Import, Loader2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldRow, SectionCard, SecondaryButton } from "@/components/forms/DrawerFormPrimitives";
import FormSideDrawer from "@/components/ui/FormSideDrawer";
import { RESPONSAVEL_FISCAL_OPTIONS } from "@/lib/constants";
import { maskCnpj, maskCpf, maskPhone, normalizePorteSigla, hasInvalidFsDirname } from "@/lib/masks";

const FIELD_CLASS =
  "w-full rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200";

export default function CompanyDrawer({ state }) {
  const { modal, form, setForm } = state;

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  return (
    <FormSideDrawer
      open={modal.open}
      title={modal.mode === "edit" ? "Editar Empresa" : "Nova Empresa"}
      onClose={state.closeCompanyModal}
      isDirty={state.isDirty}
      isSaving={state.isSaving}
      onSave={() => state.saveCompany().catch((e) => alert(e.message))}
      footerStart={
        modal.mode === "edit" ? (
          <SecondaryButton
            type="button"
            className="border-rose-200 text-rose-700 hover:bg-rose-50"
            disabled={state.isDeleting}
            onClick={() => state.deleteCompany().catch((e) => alert(e.message))}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {state.isDeleting ? "Excluindo..." : "Excluir"}
          </SecondaryButton>
        ) : null
      }
    >
      <div className="space-y-5">
        <SectionCard title="Dados principais" description="Identificação e situação da empresa">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs font-medium">CNPJ</label>

              {/* Linha principal: campo CNPJ + botão Importar */}
              <div className="mt-1 flex gap-2">
                <Input
                  className={FIELD_CLASS}
                  value={form.cnpj}
                  onChange={(e) => update({ cnpj: maskCnpj(e.target.value) })}
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md bg-[#0e2659] px-3 py-2 text-sm font-semibold text-white hover:bg-[#22489c] disabled:opacity-70"
                  disabled={state.lookupLoading || state.rfbLoading}
                  onClick={() => state.importFromReceitaWs().catch((e) => alert(e.message))}
                >
                  <Import className="h-4 w-4" />
                  {state.lookupLoading ? "Importando..." : "Importar"}
                </button>
              </div>

              {/* Erro da consulta ReceitaWS */}
              {state.lookupError ? (
                <p className="mt-1 text-xs text-rose-600">{state.lookupError}</p>
              ) : null}

              {/* Botão de fallback RFB — aparece quando ReceitaWS retorna sem dados úteis */}
              {state.showRfbButton ? (
                <div className="mt-2 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-md border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-70"
                      disabled={state.rfbLoading || state.lookupLoading}
                      onClick={() =>
                        state.importFromRfb().catch((e) => {
                          // Erro já capturado em rfbError; apenas evita unhandled rejection
                          void e;
                        })
                      }
                    >
                      {state.rfbLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Aguardando RFB...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir RFB
                        </>
                      )}
                    </button>

                    {state.rfbLoading ? (
                      <span className="text-xs text-slate-500">
                        Resolva o captcha no Chromium e clique em Consultar
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Dados não encontrados na ReceitaWS
                      </span>
                    )}
                  </div>

                  {/* Erro do agente RFB */}
                  {state.rfbError ? (
                    <p className="text-xs text-rose-600">{state.rfbError}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium">Razão Social</label>
              <Input
                className={FIELD_CLASS}
                value={form.razao_social}
                onChange={(e) => update({ razao_social: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium">Apelido (Pasta)</label>
              <Input
                data-testid="company-fs-dirname"
                className={FIELD_CLASS}
                value={form.fs_dirname}
                onChange={(e) => update({ fs_dirname: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">Nome exato da pasta em G:/EMPRESAS/&lt;PASTA&gt;</p>
              {hasInvalidFsDirname(form.fs_dirname) ? (
                <p className="mt-1 text-xs text-rose-600">Não use '..', '/', '\' ou ':'</p>
              ) : null}
            </div>

            <div>
              <label className="text-xs font-medium">Situação</label>
              <select
                className={FIELD_CLASS}
                value={form.is_active ? "ativa" : "inativa"}
                onChange={(e) => update({ is_active: e.target.value === "ativa" })}
              >
                <option value="ativa">Ativa</option>
                <option value="inativa">Inativa</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium">Porte</label>
              <Input
                className={FIELD_CLASS}
                value={form.porte}
                onChange={(e) => update({ porte: normalizePorteSigla(e.target.value) })}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Cadastro" description="Dados cadastrais da empresa">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium">Inscrição Municipal</label>
              <div className="mt-1 flex gap-2">
                <Input
                  className={FIELD_CLASS}
                  value={form.inscricao_municipal}
                  onChange={(e) => update({ inscricao_municipal: e.target.value })}
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => update({ inscricao_municipal: "-" })}
                >
                  <CircleX className="h-4 w-4" />
                  Não possui
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Inscrição Estadual</label>
              <div className="mt-1 flex gap-2">
                <Input
                  className={FIELD_CLASS}
                  value={form.inscricao_estadual}
                  onChange={(e) => update({ inscricao_estadual: e.target.value })}
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => update({ inscricao_estadual: "-" })}
                >
                  <CircleX className="h-4 w-4" />
                  Não possui
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Município</label>
              <Input
                className={FIELD_CLASS}
                value={form.municipio}
                onChange={(e) => update({ municipio: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-medium">UF</label>
              <Input
                className={FIELD_CLASS}
                value={form.uf}
                onChange={(e) => update({ uf: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium">Categoria</label>
              <Input
                className={FIELD_CLASS}
                value={form.categoria}
                onChange={(e) => update({ categoria: e.target.value })}
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.mei}
                  onChange={(e) => update({ mei: e.target.checked })}
                />
                MEI?
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.endereco_fiscal}
                  onChange={(e) => update({ endereco_fiscal: e.target.checked })}
                />
                Endereço Fiscal/Holding?
              </label>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Contato" description="Responsáveis e canais de contato">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs font-medium">Representante Legal</label>
              <Input
                className={FIELD_CLASS}
                value={form.representante}
                onChange={(e) => update({ representante: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-medium">CPF</label>
              <Input
                className={FIELD_CLASS}
                value={form.cpf}
                onChange={(e) => update({ cpf: maskCpf(e.target.value) })}
              />
            </div>

            <div>
              <label className="text-xs font-medium">E-mail</label>
              <Input
                className={FIELD_CLASS}
                value={form.email}
                onChange={(e) => update({ email: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-medium">Responsável Fiscal</label>
              <select
                className={FIELD_CLASS}
                value={form.responsavel_fiscal}
                onChange={(e) => update({ responsavel_fiscal: e.target.value })}
              >
                <option value="">Selecione</option>
                {RESPONSAVEL_FISCAL_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium">Telefone</label>
              <Input
                className={FIELD_CLASS}
                value={form.telefone}
                onChange={(e) => update({ telefone: maskPhone(e.target.value) })}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Observação" description="Notas internas da empresa">
          <FieldRow label="Observação">
            <Textarea
              data-testid="company-observacoes"
              rows={4}
              value={form.observacoes}
              onChange={(e) => update({ observacoes: e.target.value })}
            />
          </FieldRow>
        </SectionCard>

        {modal.mode === "create" ? (
          <>
            <SectionCard title="Licenças" description="Pré-cadastro opcional para nova empresa">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.add_licences}
                  onChange={(e) => update({ add_licences: e.target.checked })}
                />
                Adicionar Licenças
              </label>

              {form.add_licences ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    ["alvara_sanitario", "Alvará Sanitário"],
                    ["alvara_funcionamento", "Alvará de Funcionamento"],
                    ["cercon", "CERCON"],
                    ["licenca_ambiental", "Licença Ambiental"],
                    ["certidao_uso_solo", "Certidão Uso do Solo"],
                    ["nao_necessita", "Não necessita"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!form.licences[key]}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            licences: { ...prev.licences, [key]: e.target.checked },
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              ) : null}
            </SectionCard>

            <SectionCard title="Taxas" description="Pré-cadastro opcional para nova empresa">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.add_taxes}
                  onChange={(e) => update({ add_taxes: e.target.checked })}
                />
                Adicionar Taxas
              </label>

              {form.add_taxes ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    ["funcionamento", "Funcionamento"],
                    ["publicidade", "Publicidade"],
                    ["vigilancia_sanitaria", "Vigilância Sanitária"],
                    ["localizacao_instalacao", "Localização/Instalação"],
                    ["ocupacao_area_publica", "Área Pública"],
                    ["tpi", "TPI"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!form.taxes[key]}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            taxes: { ...prev.taxes, [key]: e.target.checked },
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}

                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium">Vencimento TPI (dd/mm)</label>
                    <Input
                      className={FIELD_CLASS}
                      value={form.taxes.vencimento_tpi}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          taxes: { ...prev.taxes, vencimento_tpi: e.target.value },
                        }))
                      }
                      placeholder="dd/mm"
                    />
                  </div>
                </div>
              ) : null}
            </SectionCard>
          </>
        ) : null}
      </div>
    </FormSideDrawer>
  );
}