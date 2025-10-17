import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItemFancy,
  MiniBadge,
  Kbd,
} from "@/components/ui/dropdown-menu";
import InlineBadge from "@/components/InlineBadge";
import StatusBadge from "@/components/StatusBadge";
import CopyableIdentifier from "@/components/CopyableIdentifier";
import { Mail, Phone, Clipboard, ExternalLink, File, Loader2 } from "lucide-react";
import { TAXA_TYPE_KEYS } from "@/lib/constants";
import { DEFAULT_CERTIFICADO_SITUACAO } from "@/lib/certificados";
import {
  getStatusKey,
  hasRelevantStatus,
  isAlertStatus,
  isProcessStatusInactive,
} from "@/lib/status";
import { openCartaoCNPJ, openCNDAnapolis, onlyDigits } from "@/lib/quickLinks";

const resolveApiBaseUrl = () => {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (fromEnv) {
    return fromEnv;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (port === "5173") {
      return `${protocol}//${hostname}:8000`;
    }
    if (port) {
      return `${protocol}//${hostname}:${port}`;
    }
    return `${protocol}//${hostname}`;
  }

  return "";
};

const API_BASE_URL = resolveApiBaseUrl();

const ensureAbsoluteUrl = (url) => {
  if (!url) return url;
  if (/^https?:/i.test(url)) {
    return url;
  }
  const normalized = url.startsWith("/") ? url : `/${url}`;
  if (!API_BASE_URL) {
    return normalized;
  }
  return `${API_BASE_URL}${normalized}`;
};

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
  const toast = (msg) => enqueueToast?.(msg);

  const [cndCache, setCndCache] = React.useState({});
  const cndCacheRef = React.useRef(cndCache);

  React.useEffect(() => {
    cndCacheRef.current = cndCache;
  }, [cndCache]);

  const ensureCNDs = React.useCallback(
    async (cnpjRaw, { force = false } = {}) => {
      const digits = onlyDigits(cnpjRaw || "");
      if (!digits) {
        return [];
      }

      const cached = cndCacheRef.current[digits];
      if (!force) {
        if (cached?.loading) {
          return cached.items || [];
        }
        if (cached?.items) {
          return cached.items;
        }
      }

      setCndCache((prev) => ({
        ...prev,
        [digits]: { ...(prev[digits] || {}), loading: true },
      }));

      try {
        const response = await fetch(`${API_BASE_URL}/api/cnds/${digits}/list`);
        const items = response.ok ? await response.json() : [];
        setCndCache((prev) => ({
          ...prev,
          [digits]: { items, loading: false },
        }));
        return items;
      } catch (error) {
        console.error("[CND] Falha ao listar PDFs:", error);
        setCndCache((prev) => ({
          ...prev,
          [digits]: { items: [], loading: false, error: true },
        }));
        toast?.("Não foi possível verificar as CNDs desta empresa.");
        return [];
      }
    },
    [toast]
  );

  const isMunicipioAnapolis = React.useCallback((municipio) => {
    const normalized = (municipio || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
    const sanitized = normalized.replace(/[^a-z/\s]/g, " ");
    return sanitized
      .split(/[\\/]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .some((part) => part === "anapolis");
  }, []);

  const emitirCNDMunicipal = React.useCallback(
    async (cnpj, municipio, abrirPortal = false) => {
      const digits = onlyDigits(cnpj || "");
      if (!digits || digits.length !== 14) {
        toast?.("CNPJ inválido para emissão da CND.");
        return;
      }

      if (abrirPortal) {
        if (isMunicipioAnapolis(municipio)) {
          await openCNDAnapolis(cnpj, toast);
        } else {
          toast?.("Abertura manual disponível apenas para Anápolis no momento.");
        }
        return;
      }

      const municipioNome = (municipio || "").trim();

      try {
        const destinoLabel = municipioNome || "município informado";
        toast?.(`Iniciando emissão da CND (${destinoLabel}).`);
        const resp = await fetch(`${API_BASE_URL}/api/cnds/emitir`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cnpj, municipio: municipioNome }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(data?.detail || data?.info || "Falha ao emitir a CND.");
        }
        if (data?.ok) {
          toast?.("CND emitida com sucesso.");
          if (data?.url) {
            console.info("CND Municipal disponível em:", ensureAbsoluteUrl(data.url));
          } else if (data?.path) {
            console.info("CND Municipal salva em:", data.path);
          }
          await ensureCNDs(cnpj, { force: true });
        } else {
          toast?.(data?.info || "Não foi possível emitir a CND.");
        }
      } catch (error) {
        toast?.(error?.message || "Erro inesperado ao emitir a CND.");
      }
    },
    [ensureCNDs, isMunicipioAnapolis, toast]
  );

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
              if (!hasRelevantStatus(lic.status)) return acc;
              const statusKey = getStatusKey(lic.status);
              acc.total += 1;
              if (statusKey.includes("vencid")) acc.vencidas += 1;
              else if (statusKey.includes("vence")) acc.vencendo += 1;
              else acc.ativas += 1;
              return acc;
            },
            { total: 0, ativas: 0, vencendo: 0, vencidas: 0 }
          );
          const taxa = empresaId !== undefined ? taxasByEmpresa.get(empresaId) : undefined;
          const processosEmpresa =
            empresaId !== undefined ? processosByEmpresa.get(empresaId) || [] : [];
          const processosAtivosEmpresa = processosEmpresa.filter(
            (proc) => !isProcessStatusInactive(proc.status)
          );
          const rawId =
            empresa.empresa_id ?? empresa.empresaId ?? empresa.id ?? extractEmpresaId(empresa);
          const avatarLabel =
            rawId !== undefined && rawId !== null && `${rawId}`.toString().trim() !== ""
              ? `${rawId}`
              : "?";

          const cnpjDigits = onlyDigits(empresa.cnpj || "");
          const cndEntry = cndCache[cnpjDigits] || {};
          const cndLoading = Boolean(cndEntry.loading);
          const hasCND = Array.isArray(cndEntry.items) && cndEntry.items.length > 0;
          const municipioInformado = Boolean((empresa.municipio || "").trim());

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
                        Certificado: {empresa.certificado || DEFAULT_CERTIFICADO_SITUACAO}
                      </InlineBadge>
                      <InlineBadge variant="outline" className="bg-white">
                        Débito: {empresa.debito}
                      </InlineBadge>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
                    <p className="text-[11px] uppercase text-emerald-600 font-semibold">Licenças</p>
                    <div className="mt-1 flex items-end gap-2">
                      <span className="text-2xl font-semibold text-emerald-700">
                        {licSummary.total}
                      </span>
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
                      <span className="text-2xl font-semibold text-sky-700">
                        {processosEmpresa.length}
                      </span>
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
                    onClick={() =>
                      handleCopy(empresa.telefone, `Telefone copiado: ${empresa.telefone}`)
                    }
                    className="text-xs"
                  >
                    <Phone className="h-3.5 w-3.5 mr-1" /> Copiar telefone
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="text-xs">
                        <Clipboard className="h-3.5 w-3.5 mr-1" /> Ações rápidas
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-72">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      <DropdownMenuItemFancy
                        icon={ExternalLink}
                        title={
                          <span className="inline-flex items-center">
                            Cartão CNPJ <MiniBadge>RFB</MiniBadge>
                          </span>
                        }
                        description="Ir para site da RFB."
                        hint={<Kbd>Ctrl</Kbd>}
                        onClick={() => openCartaoCNPJ(empresa.cnpj, toast)}
                      />

                      <DropdownMenuItemFancy
                        icon={ExternalLink}
                        title={
                          <span className="inline-flex items-center">
                            CND Municipal <MiniBadge>PM</MiniBadge>
                          </span>
                        }
                        description="Emitir a partir do portal da Prefeitura."
                        hint={<Kbd>Ctrl</Kbd>}
                        disabled={!municipioInformado}
                        onClick={(event) => {
                          const originalEvent = event?.detail?.originalEvent;
                          const abrirPortal = Boolean(
                            originalEvent?.ctrlKey || originalEvent?.metaKey
                          );
                          emitirCNDMunicipal(empresa.cnpj, empresa.municipio, abrirPortal);
                        }}
                      />

                      {/* próximos itens: CND Goiânia, CND Megasoft/Centi etc. */}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu
                    onOpenChange={(open) => {
                      if (open) {
                        ensureCNDs(empresa.cnpj);
                      }
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="text-xs">
                        <File className="h-3.5 w-3.5 mr-1" /> Certidões
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-72">
                      <DropdownMenuLabel>Certidões</DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      <DropdownMenuItemFancy
                        icon={File}
                        title="CND Municipal"
                        description="Abrir a última CND emitida."
                        disabled={cndLoading || !hasCND}
                        hint={
                          cndLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                          ) : undefined
                        }
                        onClick={async () => {
                          let lista = cndEntry.items;
                          if (!Array.isArray(lista) || lista.length === 0) {
                            lista = await ensureCNDs(empresa.cnpj, { force: true });
                          }

                          if (!lista || lista.length === 0) {
                            toast?.("Nenhuma CND encontrada para esta empresa.");
                            return;
                          }

                          const url = lista[0]?.url;
                          if (url) {
                            window.open(ensureAbsoluteUrl(url), "_blank", "noopener,noreferrer");
                          } else {
                            toast?.("Não foi possível localizar o arquivo da CND.");
                          }
                        }}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
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
