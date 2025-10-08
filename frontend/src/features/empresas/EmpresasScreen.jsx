import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import InlineBadge from "@/components/InlineBadge";
import StatusBadge from "@/components/StatusBadge";
import CopyableIdentifier from "@/components/CopyableIdentifier";
import { Mail, Phone, Clipboard } from "lucide-react";
import { TAXA_TYPE_KEYS } from "@/lib/constants";
import {
  getStatusKey,
  hasRelevantStatus,
  isAlertStatus,
  isProcessStatusInactive,
} from "@/lib/status";

export default function EmpresasScreen({
  filteredEmpresas,
  empresas,
  soAlertas,
  extractEmpresaId,
  licencasByEmpresa,
  taxasByEmpresa,
  processosByEmpresa,
  handleCopy,
  enqueueToast,
}) {
  return (
    <>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {filteredEmpresas.length} de {empresas.length} empresas exibidas
        </span>
        {soAlertas && <InlineBadge variant="outline">Modo alertas ativo</InlineBadge>}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {filteredEmpresas.map((empresa) => {
          const empresaId = extractEmpresaId(empresa);
          const licList = empresaId !== undefined ? licencasByEmpresa.get(empresaId) || [] : [];
          const licSummary = licList.reduce(
            (acc, lic) => {
              if (!hasRelevantStatus(lic.status)) {
                return acc;
              }
              const statusKey = getStatusKey(lic.status);
              acc.total += 1;
              if (statusKey.includes("vencid")) acc.vencidas += 1;
              else if (statusKey.includes("vence")) acc.vencendo += 1;
              else acc.ativas += 1;
              return acc;
            },
            { total: 0, ativas: 0, vencendo: 0, vencidas: 0 },
          );
          const taxa = empresaId !== undefined ? taxasByEmpresa.get(empresaId) : undefined;
          const processosEmpresa =
            empresaId !== undefined ? processosByEmpresa.get(empresaId) || [] : [];
          const processosAtivosEmpresa = processosEmpresa.filter(
            (proc) => !isProcessStatusInactive(proc.status),
          );
          const rawId =
            empresa.empresa_id ?? empresa.empresaId ?? empresa.id ?? extractEmpresaId(empresa);
          const avatarLabel =
            rawId !== undefined && rawId !== null && `${rawId}`.toString().trim() !== ""
              ? `${rawId}`
              : "?";
          return (
            <Card key={empresa.id} className="shadow-sm overflow-hidden border border-white/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-700 font-semibold grid place-items-center">
                    {avatarLabel}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold leading-tight text-slate-800">
                          {empresa.empresa}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <CopyableIdentifier label="CNPJ" value={empresa.cnpj} onCopy={handleCopy} />
                          <span className="text-slate-300">•</span>
                          <CopyableIdentifier label="IE" value={empresa.ie} onCopy={handleCopy} />
                          <span className="text-slate-300">•</span>
                          <CopyableIdentifier label="IM" value={empresa.im} onCopy={handleCopy} />
                          <span className="text-slate-400">• {empresa.municipio}</span>
                        </div>
                      </div>
                      <StatusBadge status={empresa.situacao || "Ativa"} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                      <InlineBadge variant="outline" className="bg-white">
                        Categoria: {empresa.categoria || "—"}
                      </InlineBadge>
                      <InlineBadge variant="outline" className="bg-white">
                        Certificado: {empresa.certificado}
                      </InlineBadge>
                      <div className="inline-flex items-center gap-1">
                        <span>Débito:</span>
                        <StatusBadge status={empresa.debito} />
                      </div>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
                    <p className="text-[11px] uppercase text-emerald-600 font-semibold">Licenças</p>
                    <div className="mt-1 flex items-end gap-2">
                      <span className="text-2xl font-semibold text-emerald-700">{licSummary.total}</span>
                      <div className="space-y-0.5 text-[11px] text-emerald-700/80">
                        <p>Ativas: {licSummary.ativas}</p>
                        <p>Vencendo: {licSummary.vencendo}</p>
                        <p>Vencidas: {licSummary.vencidas}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-sky-100 bg-sky-50/70 p-3">
                    <p className="text-[11px] uppercase text-sky-600 font-semibold">Processos</p>
                    <div className="mt-1 flex items-end gap-2">
                      <span className="text-2xl font-semibold text-sky-700">{processosEmpresa.length}</span>
                      <div className="space-y-0.5 text-[11px] text-sky-700/80">
                        <p>Ativos: {processosAtivosEmpresa.length}</p>
                        <p>Encerrados: {processosEmpresa.length - processosAtivosEmpresa.length}</p>
                        <p>
                          Taxas pend.:
                          {taxa
                            ? TAXA_TYPE_KEYS.filter((key) => isAlertStatus(taxa?.[key])).length
                            : 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(empresa.email, `E-mail copiado: ${empresa.email}`)}
                    className="text-xs"
                  >
                    <Mail className="h-3.5 w-3.5 mr-1" /> Copiar e-mail
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(empresa.telefone, `Telefone copiado: ${empresa.telefone}`)}
                    className="text-xs"
                  >
                    <Phone className="h-3.5 w-3.5 mr-1" /> Copiar telefone
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => enqueueToast(`Solicitar documentos para ${empresa.empresa}`)}
                    className="text-xs"
                  >
                    <Clipboard className="h-3.5 w-3.5 mr-1" /> Ações rápidas
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredEmpresas.length === 0 && (
          <Card className="shadow-sm">
            <CardContent className="p-6 text-center text-sm text-slate-600">
              Nenhuma empresa encontrada com os filtros atuais.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
