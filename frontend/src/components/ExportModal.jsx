import React from "react";
import { Loader2 } from "lucide-react";
import OverlayModal from "@/components/ui/OverlayModal";
import { Button } from "@/components/ui/button";
import { exportarRelatorio, listarCamposRelatorio } from "@/services/relatorios";

const OBRIGATORIOS_FALLBACK = ["id", "cnpj", "razao_social"];

export default function ExportModal({ open, onClose, enqueueToast }) {
  const [loadingFields, setLoadingFields] = React.useState(false);
  const [loadingExport, setLoadingExport] = React.useState(false);
  const [error, setError] = React.useState("");
  const [obrigatorios, setObrigatorios] = React.useState(OBRIGATORIOS_FALLBACK);
  const [opcionais, setOpcionais] = React.useState([]);
  const [labels, setLabels] = React.useState({});
  const [selected, setSelected] = React.useState(new Set());
  const markAllRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setLoadingFields(true);
      setError("");
      try {
        const payload = await listarCamposRelatorio();
        if (cancelled) return;
        const obrigatoriosList = Array.isArray(payload?.obrigatorios) && payload.obrigatorios.length > 0
          ? payload.obrigatorios
          : OBRIGATORIOS_FALLBACK;
        const opcionaisList = Array.isArray(payload?.opcionais) ? payload.opcionais : [];
        const labelsMap = payload?.labels && typeof payload.labels === "object" ? payload.labels : {};
        setObrigatorios(obrigatoriosList);
        setOpcionais(opcionaisList);
        setLabels(labelsMap);
        setSelected(new Set(opcionaisList));
      } catch (err) {
        if (cancelled) return;
        setError("Não foi possível carregar os campos para exportação.");
      } finally {
        if (!cancelled) setLoadingFields(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedCount = selected.size;
  const totalCount = obrigatorios.length + opcionais.length;
  const allOptionalsSelected = opcionais.length > 0 && selectedCount === opcionais.length;
  const someOptionalsSelected = selectedCount > 0 && selectedCount < opcionais.length;

  React.useEffect(() => {
    if (!markAllRef.current) return;
    markAllRef.current.indeterminate = someOptionalsSelected;
  }, [someOptionalsSelected]);

  const toggleOptional = (field) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === opcionais.length) return new Set();
      return new Set(opcionais);
    });
  };

  const handleExport = async () => {
    setLoadingExport(true);
    setError("");
    try {
      await exportarRelatorio({ campos: Array.from(selected) });
      enqueueToast?.("Relatório exportado com sucesso.");
      onClose?.();
    } catch {
      setError("Falha ao exportar o relatório. Tente novamente.");
    } finally {
      setLoadingExport(false);
    }
  };

  return (
    <OverlayModal
      open={open}
      onClose={onClose}
      title="Exportar relatório"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-slate-600">
            {obrigatorios.length + selectedCount} de {totalCount} campos selecionados
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loadingExport}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleExport} disabled={loadingExport || loadingFields}>
              {loadingExport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loadingExport ? "Exportando..." : "Exportar"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {loadingFields ? (
          <div className="rounded-xl border border-subtle bg-surface p-4 text-sm text-slate-600">
            Carregando campos disponíveis...
          </div>
        ) : (
          <>
            <section className="rounded-xl border border-subtle bg-surface p-4">
              <h3 className="text-sm font-semibold text-slate-800">Obrigatórios</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {obrigatorios.map((field) => (
                  <label key={field} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked disabled />
                    <span>{labels[field] || field}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-subtle bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">Opcionais</h3>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    ref={markAllRef}
                    type="checkbox"
                    checked={allOptionalsSelected}
                    onChange={toggleAll}
                    disabled={opcionais.length === 0}
                  />
                  <span>Marcar todos</span>
                </label>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {opcionais.map((field) => (
                  <label key={field} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selected.has(field)}
                      onChange={() => toggleOptional(field)}
                    />
                    <span>{labels[field] || field}</span>
                  </label>
                ))}
                {opcionais.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum campo opcional disponível.</p>
                ) : null}
              </div>
            </section>
          </>
        )}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    </OverlayModal>
  );
}
