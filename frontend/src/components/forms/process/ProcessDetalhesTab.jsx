import React from "react";
import { Input } from "@/components/ui/input";
import { SecondaryButton } from "@/components/forms/DrawerFormPrimitives";
import ProcessCerconTaxFields from "@/components/forms/process/ProcessCerconTaxFields";

export default function ProcessDetalhesTab({
  form,
  state,
  fieldClass,
  FieldBlock,
  SectionHeader,
  ambientalOperacaoOptions,
  update,
}) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Detalhes" subtitle="Campos complementares por tipo de processo" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FieldBlock label="Município">
          <Input className={fieldClass} value={form.municipio} onChange={(e) => update({ municipio: e.target.value })} />
        </FieldBlock>

        {form.process_type === "DIVERSOS" ? (
          <>
            <FieldBlock label="Operação" required>
              <select className={fieldClass} value={form.extra?.operacao || ""} onChange={(e) => state.updateExtra("operacao", e.target.value)}>
                <option value="">Selecione</option>
                {state.processOperacoes.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </FieldBlock>
            <FieldBlock label="Órgão" required>
              <select className={fieldClass} value={form.extra?.orgao || ""} onChange={(e) => state.updateExtra("orgao", e.target.value)}>
                <option value="">Selecione</option>
                {state.processOrgaos.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </FieldBlock>
          </>
        ) : null}

        {form.process_type === "FUNCIONAMENTO" ? (
          <FieldBlock label="Alvará">
            <select className={fieldClass} value={form.extra?.alvara || ""} onChange={(e) => state.updateExtra("alvara", e.target.value)}>
              <option value="">Selecione</option>
              {state.processAlvaras.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </FieldBlock>
        ) : null}

        {form.process_type === "CERCON" ? (
          <>
            <FieldBlock label="Área (m²)">
              <Input
                className={fieldClass}
                value={form.extra?.area_m2 || ""}
                onChange={(e) => state.updateExtra("area_m2", String(e.target.value || "").replace(/[^\d.,]/g, ""))}
              />
            </FieldBlock>
            <ProcessCerconTaxFields state={state} form={form} fieldClass={fieldClass} FieldBlock={FieldBlock} />
            <FieldBlock label="Projeto aprovado">
              <div className="space-y-2">
                <Input className={fieldClass} value={form.extra?.projeto_aprovado || ""} onChange={(e) => state.updateExtra("projeto_aprovado", e.target.value)} />
                <div className="flex gap-2">
                  <SecondaryButton type="button" size="sm" onClick={() => state.updateExtra("projeto_aprovado", "nao_possui")}>Não possui</SecondaryButton>
                  <SecondaryButton type="button" size="sm" onClick={() => state.updateExtra("projeto_aprovado", "nao_precisa")}>Não precisa</SecondaryButton>
                </div>
              </div>
            </FieldBlock>
          </>
        ) : null}

        {form.process_type === "USO_DO_SOLO" ? (
          <FieldBlock label="Inscrição imobiliária">
            <Input className={fieldClass} value={form.extra?.inscricao_imobiliaria || ""} onChange={(e) => state.updateExtra("inscricao_imobiliaria", e.target.value)} />
          </FieldBlock>
        ) : null}

        {form.process_type === "ALVARA_SANITARIO" ? (
          <>
            <FieldBlock label="Serviço">
              <select className={fieldClass} value={form.extra?.servico || ""} onChange={(e) => state.updateExtra("servico", e.target.value)}>
                <option value="">Selecione</option>
                {state.processServicos.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </FieldBlock>
            <FieldBlock label="Notificação">
              <select className={fieldClass} value={form.extra?.notificacao || ""} onChange={(e) => state.updateExtra("notificacao", e.target.value)}>
                <option value="">Selecione</option>
                {state.processNotificacoes.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </FieldBlock>
          </>
        ) : null}

        {form.process_type === "LICENCA_AMBIENTAL" ? (
          <FieldBlock label="Operação" required>
            <select className={fieldClass} value={form.extra?.operacao || ""} onChange={(e) => state.updateExtra("operacao", e.target.value)}>
              <option value="">Selecione</option>
              {ambientalOperacaoOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </FieldBlock>
        ) : null}
      </div>
    </div>
  );
}
