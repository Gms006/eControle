import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function OverlayModal({
  open,
  title,
  header,
  onClose,
  children,
  footer,
  className,
  bodyClassName,
  footerClassName,
  closeOnOverlayClick = true,
}) {
  React.useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-[3px]">
      <button
        type="button"
        aria-label="Fechar modal"
        className="absolute inset-0"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      <div className={cn("relative my-6 flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl", className)}>
        {header || title ? (
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
            {header || <div className="text-sm font-semibold text-slate-900">{title}</div>}
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className={cn("overflow-auto p-4", bodyClassName)}>{children}</div>

        {footer ? (
          <div className={cn("sticky bottom-0 border-t bg-white px-4 py-3", footerClassName)}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
