import React from "react";
import { SecondaryButton } from "@/components/forms/DrawerFormPrimitives";

export default function ProcessDrawerFooter({ isSaving, onClose, onSave }) {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-end gap-2">
        <SecondaryButton type="button" onClick={onClose}>
          Cancelar
        </SecondaryButton>
        <button
          type="button"
          className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSaving}
          onClick={onSave}
        >
          {isSaving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </footer>
  );
}
