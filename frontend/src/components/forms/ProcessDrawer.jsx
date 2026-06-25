import React from "react";
import { createPortal } from "react-dom";
import ProcessDadosTab from "@/components/forms/process/ProcessDadosTab";
import ProcessDetalhesTab from "@/components/forms/process/ProcessDetalhesTab";
import ProcessDrawerFooter from "@/components/forms/process/ProcessDrawerFooter";
import ProcessDrawerHeader from "@/components/forms/process/ProcessDrawerHeader";
import ProcessDrawerSidebar from "@/components/forms/process/ProcessDrawerSidebar";
import ProcessObservacaoTab from "@/components/forms/process/ProcessObservacaoTab";
import {
  AMBIENTAL_OPERACAO_OPTIONS,
  PROCESS_DRAWER_FIELD_CLASS,
  PROCESS_TYPE_OPTIONS,
  ProcessDrawerFieldBlock,
  ProcessDrawerSectionHeader,
} from "@/components/forms/process/ProcessDrawerPrimitives";
import { buildProcessDrawerView } from "@/components/forms/process/ProcessDrawerView";
import { useProcessDrawerUi } from "@/hooks/processos/useProcessDrawerUi";

export default function ProcessDrawer({ state }) {
  const { modal, form, setForm } = state;
  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const { activeTab, setActiveTab } = useProcessDrawerUi({
    isOpen: modal.open,
    onClose: state.closeProcessModal,
  });
  const {
    companyRazaoSocial,
    companyLabel,
    companyInitials,
    statusLabel,
    municipioLabel,
    servicoLabel,
    notificacaoLabel,
    headerEyebrow,
    headerTitle,
  } = buildProcessDrawerView({
    form,
    modal,
    companyOptions: state.companyOptions,
    processSituacoes: state.processSituacoes,
    processServicos: state.processServicos,
    processNotificacoes: state.processNotificacoes,
  });

  const save = () => state.saveProcess().catch((e) => alert(e.message));
  const remove = () => state.deleteProcess().catch((e) => alert(e.message));

  if (!modal.open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]">
      <button type="button" aria-label="Fechar modal" className="absolute inset-0" onClick={state.closeProcessModal} />
      <div className="relative z-10 flex w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" style={{ maxWidth: "860px", height: "min(700px, calc(100dvh - 2rem))", minHeight: "560px" }}>
        <ProcessDrawerSidebar
          modal={modal}
          form={form}
          companyInitials={companyInitials}
          companyLabel={companyLabel}
          statusLabel={statusLabel}
          municipioLabel={municipioLabel}
          servicoLabel={servicoLabel}
          notificacaoLabel={notificacaoLabel}
          isDeleting={state.isDeleting}
          onRemove={remove}
        />

        <section className="flex min-w-0 flex-1 flex-col bg-white">
          <ProcessDrawerHeader
            headerEyebrow={headerEyebrow}
            headerTitle={headerTitle}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onClose={state.closeProcessModal}
          />

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {activeTab === "dados" ? (
              <ProcessDadosTab
                modal={modal}
                form={form}
                setForm={setForm}
                state={state}
                companyRazaoSocial={companyRazaoSocial}
                fieldClass={PROCESS_DRAWER_FIELD_CLASS}
                FieldBlock={ProcessDrawerFieldBlock}
                SectionHeader={ProcessDrawerSectionHeader}
                processTypeOptions={PROCESS_TYPE_OPTIONS}
                update={update}
              />
            ) : null}

            {activeTab === "detalhes" ? (
              <ProcessDetalhesTab
                form={form}
                state={state}
                fieldClass={PROCESS_DRAWER_FIELD_CLASS}
                FieldBlock={ProcessDrawerFieldBlock}
                SectionHeader={ProcessDrawerSectionHeader}
                ambientalOperacaoOptions={AMBIENTAL_OPERACAO_OPTIONS}
                update={update}
              />
            ) : null}

            {activeTab === "observacao" ? (
              <ProcessObservacaoTab
                form={form}
                fieldClass={PROCESS_DRAWER_FIELD_CLASS}
                FieldBlock={ProcessDrawerFieldBlock}
                SectionHeader={ProcessDrawerSectionHeader}
                update={update}
              />
            ) : null}
          </div>

          <ProcessDrawerFooter
            isSaving={state.isSaving}
            onClose={state.closeProcessModal}
            onSave={save}
          />
        </section>
      </div>
    </div>,
    document.body,
  );
}
