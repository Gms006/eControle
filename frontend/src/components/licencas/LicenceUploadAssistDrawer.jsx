import React from "react";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCnpj } from "@/lib/text";

export default function LicenceUploadAssistDrawer({
  open,
  onClose,
  draft,
  setDraft,
  onConfirm,
  onAddFiles,
  uploading,
  companyOptions,
  detectKindOptions,
}) {
  const canSubmit = Boolean(draft?.companyId?.trim()) && (draft?.items || []).length > 0;

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Upload assistido de licenças"
      subtitle="Detecta tipo e validade pelo nome do arquivo. Confirme antes de enviar."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onAddFiles} disabled={uploading}>
            Adicionar arquivos
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={!canSubmit || uploading}>
            {uploading ? "Enviando..." : "Enviar arquivos"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Empresa</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={draft.companyId}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                companyId: event.target.value,
              }))
            }
          >
            <option value="">Selecione</option>
            {companyOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {(item.razao_social || item.empresa || "Empresa")} - {formatCnpj(item.cnpj)}
              </option>
            ))}
          </select>
        </div>
        {(draft?.items || []).length > 0 ? (
          <p className="text-xs text-slate-600">
            Arquivos selecionados: {draft.items.length}
          </p>
        ) : null}
        <div className="space-y-3">
          {draft.items.map((item, index) => (
            <div key={`${item.originalFilename}-${index}`} className="rounded-xl border border-slate-200 p-3">
              <div className="text-sm font-medium text-slate-800">{item.originalFilename}</div>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Tipo sugerido</Label>
                  <Select
                    value={item.kind || "__none__"}
                    onValueChange={(value) =>
                      setDraft((prev) => ({
                        ...prev,
                        items: prev.items.map((current, idx) =>
                          idx === index ? { ...current, kind: value === "__none__" ? "" : value } : current,
                        ),
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Selecione</SelectItem>
                      {detectKindOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Validade</Label>
                  <Input
                    type="date"
                    value={item.expiresAt || ""}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        items: prev.items.map((current, idx) =>
                          idx === index ? { ...current, expiresAt: event.target.value } : current,
                        ),
                      }))
                    }
                    disabled={item.isDefinitive}
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.isDefinitive}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        items: prev.items.map((current, idx) =>
                          idx === index ? { ...current, isDefinitive: event.target.checked } : current,
                        ),
                      }))
                    }
                  />
                  Definitivo
                </label>
                <span>Confiança: {Math.round((item.confidence || 0) * 100)}%</span>
                {item.canonicalFilename ? <span>Canônico: {item.canonicalFilename}</span> : null}
              </div>
              {(item.warnings || []).length > 0 ? (
                <div className="mt-2 text-xs text-amber-700">{item.warnings.join(" | ")}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </SideDrawer>
  );
}
