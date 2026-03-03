import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SideDrawer({
  open,
  title,
  subtitle,
  onClose,
  footer,
  className,
  children,
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
    <div className="fixed inset-0 z-[2147483647] flex">
      <button
        type="button"
        aria-label="Fechar painel lateral"
        className="flex-1 bg-slate-950/45 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <section
        className={cn(
          "relative flex h-full w-full max-w-xl flex-col border-l border-subtle bg-surface shadow-2xl md:w-[44vw] md:max-w-[560px]",
          className,
        )}
      >
        <header className="sticky top-0 z-10 border-b border-subtle bg-surface/95 p-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              {subtitle ? (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-status-info">{subtitle}</p>
              ) : null}
              {title ? <h2 className="text-base font-semibold text-primary">{title}</h2> : null}
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-subtle bg-card text-slate-500 transition hover:border-strong hover:text-slate-800"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <div className="border-t border-subtle bg-surface p-4">{footer}</div> : null}
      </section>
    </div>,
    document.body,
  );
}

export default SideDrawer;
