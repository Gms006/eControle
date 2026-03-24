import React from "react";
import SideDrawer from "@/components/ui/side-drawer";
import {
  PrimaryButton,
  SecondaryButton,
} from "@/components/forms/DrawerFormPrimitives";

export default function FormSideDrawer({
  open,
  title,
  subtitle = "Cadastro",
  onClose,
  onSave,
  isDirty = false,
  isSaving = false,
  saveLabel = "Salvar",
  savingLabel = "Salvando...",
  footerStart = null,
  children,
}) {
  const requestClose = React.useCallback(() => {
    if (isDirty && !window.confirm("Existem alterações não salvas. Deseja fechar mesmo assim?")) {
      return;
    }
    onClose?.();
  }, [isDirty, onClose]);

  return (
    <SideDrawer
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={requestClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div>{footerStart}</div>
          <div className="flex items-center gap-2">
            <SecondaryButton type="button" onClick={requestClose}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="button" disabled={isSaving} onClick={onSave}>
              {isSaving ? savingLabel : saveLabel}
            </PrimaryButton>
          </div>
        </div>
      }
    >
      {children}
    </SideDrawer>
  );
}