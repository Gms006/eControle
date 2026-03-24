import React from "react";
import { createPortal } from "react-dom";

export default function OverlayModal({ open, title, onClose, children, footer }) {
  React.useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-6 flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm hover:bg-slate-100"
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="overflow-auto p-4">{children}</div>

        {footer ? (
          <div className="sticky bottom-0 border-t bg-white px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}