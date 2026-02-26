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
import { Chip } from "@/components/Chip";
import CompanyAvatar from "@/components/common/CompanyAvatar";
import StatusBadge from "@/components/StatusBadge";
import CopyableIdentifier from "@/components/CopyableIdentifier";
import { Mail, Phone, Clipboard, ExternalLink, File, Loader2 } from "lucide-react";
import { TAXA_TYPE_KEYS } from "@/lib/constants";
import { DEFAULT_CERTIFICADO_SITUACAO } from "@/lib/certificados";
import { cn } from "@/lib/utils";
import {
  getStatusKey,
  hasRelevantStatus,
  isAlertStatus,
  isProcessStatusInactive,
} from "@/lib/status";
import {
  openCartaoCNPJ,
  openCNDAnapolis,
  openCAEAnapolis,
  onlyDigits,
  normalizeIM,
} from "@/lib/quickLinks";
import { formatCpf, formatPhoneBr } from "@/lib/text";

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
    if (port === "5174") {
      return `${protocol}//${hostname}:8020`;
    }
    if (port) {
      return `${protocol}//${hostname}:${port}`;
    }
    return `${protocol}//${hostname}`;
  }

  return "";
};

const API_BASE_URL = resolveApiBaseUrl();
const VIEW_MODE_KEY = "econtrole.empresas.viewMode";

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

  const [viewMode, setViewMode] = React.useState(() => {
    if (typeof window === "undefined") {
      return "compact";
    }

    const stored = window.localStorage.getItem(VIEW_MODE_KEY);
    return stored === "detailed" ? "detailed" : "compact";
  });

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

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

  const handleEmitirCAE = React.useCallback(
    async (event, empresaInfo) => {
      const originalEvent = event?.detail?.originalEvent;
      const isCtrl = Boolean(originalEvent?.ctrlKey || originalEvent?.metaKey);
      const imRaw =
        empresaInfo?.inscricaoMunicipal || empresaInfo?.im || "";
      const im = normalizeIM(imRaw);

      if (!isMunicipioAnapolis(empresaInfo?.municipio)) {
        toast?.("Disponível apenas para Anápolis.");
        return;
      }

      if (!im) {
        toast?.("Inscrição Municipal não informada.");
        return;
      }

      if (isCtrl) {
        await openCAEAnapolis(imRaw, toast);
        return;
      }

      try {
        toast?.("Iniciando emissão da CAE (Anápolis).");
        const resp = await fetch(`${API_BASE_URL}/api/cae/emitir`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            municipio: "Anápolis",
            cnpj: empresaInfo?.cnpj,
            im,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          const detail =
            (data?.detail && (data?.detail?.info || data?.detail)) ||
            data?.info;
          throw new Error(detail || "Falha ao emitir a CAE.");
        }
        if (data?.ok) {
          toast?.("CAE emitida com sucesso.");
          await ensureCNDs(empresaInfo?.cnpj, { force: true });
        } else {
          toast?.(data?.info || "Não foi possível emitir a CAE.");
        }
      } catch (error) {
        toast?.(error?.message || "Erro inesperado ao emitir a CAE.");
      }
    },
    [ensureCNDs, isMunicipioAnapolis, toast]
  );

  return (
    <>
      <div
        className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"
        data-testid="companies-summary"
      >
        <span>
          {filteredEmpresas.length} de {empresas.length} empresas exibidas
        </span>
        <div className="flex items-center gap-3">
          {soAlertas && <Chip variant="warning">Modo alertas ativo</Chip>}

          <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setViewMode("compact")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition",
                viewMode === "compact"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Compacto
            </button>
            <button
              type="button"
              onClick={() => setViewMode("detailed")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition",
                viewMode === "detailed"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Detalhado
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2" data-testid="companies-grid">
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

          const cnpjDigits = onlyDigits(empresa.cnpj || "");
          const hasValidCnpj = cnpjDigits.length === 14;
          const municipioInformado = Boolean((empresa.municipio || "").trim());
          const municipioAnapolis = isMunicipioAnapolis(empresa.municipio);
          const inscricaoMunicipalRaw = empresa.inscricaoMunicipal || empresa.im || "";
          const hasValidIM = Boolean(normalizeIM(inscricaoMunicipalRaw));
          const cndEntry = cndCache[cnpjDigits] || {};
          const cndItems = Array.isArray(cndEntry.items) ? cndEntry.items : [];
          const hasCND = cndItems.length > 0;
          const caeFiles = cndItems.filter((item) =>
            item?.name?.startsWith("CAE - ")
          );
          const lastCAE = caeFiles[0];
          const cardKey =
            empresa.id ?? empresaId ?? rawId ?? `${empresa.empresa}-${empresa.cnpj}`;

          return (
            <EmpresaCard
              key={cardKey}
              cndEntry={cndEntry}
              empresa={empresa}
              ensureCNDs={ensureCNDs}
              emitirCNDMunicipal={emitirCNDMunicipal}
              handleCopy={handleCopy}
              handleEmitirCAE={handleEmitirCAE}
              hasCND={hasCND}
              hasValidCnpj={hasValidCnpj}
              hasValidIM={hasValidIM}
              lastCAE={lastCAE}
              licSummary={licSummary}
              municipioAnapolis={municipioAnapolis}
              municipioInformado={municipioInformado}
              processosAtivosEmpresa={processosAtivosEmpresa}
              processosEmpresa={processosEmpresa}
              taxa={taxa}
              toast={toast}
              viewMode={viewMode}
            />
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

function EmpresaCard({
  cndEntry,
  empresa,
  emitirCNDMunicipal,
  ensureCNDs,
  handleCopy,
  handleEmitirCAE,
  hasCND,
  hasValidCnpj,
  hasValidIM,
  lastCAE,
  licSummary,
  municipioAnapolis,
  municipioInformado,
  processosAtivosEmpresa,
  processosEmpresa,
  taxa,
  toast,
  viewMode,
}) {
  const isCompact = viewMode === "compact";
  const cndLoading = Boolean(cndEntry?.loading);

  const contactItems = [];
  if (empresa.telefone) contactItems.push({ label: "Telefone", value: empresa.telefone });
  if (empresa.email) contactItems.push({ label: "E-mail", value: empresa.email });

  const responsavelItems = [];
  if (empresa.responsavelLegal)
    responsavelItems.push({ label: "Legal", value: empresa.responsavelLegal });
  if (empresa.cpfResponsavelLegal)
    responsavelItems.push({ label: "CPF resp. legal", value: empresa.cpfResponsavelLegal });
  if (empresa.responsavelFiscal)
    responsavelItems.push({ label: "Fiscal", value: empresa.responsavelFiscal });

  const showContacts = viewMode === "detailed" && contactItems.length > 0;
  const showResponsaveis = viewMode === "detailed" && responsavelItems.length > 0;

  return (
    <Card
      className="overflow-hidden bg-white rounded-2xl border border-slate-200/60 shadow-sm transition hover:shadow-md"
      data-testid="company-card"
    >
      <CardContent className={cn("p-0", isCompact ? "space-y-2" : "space-y-3")}>
        <div className={cn("flex items-start", isCompact ? "gap-2" : "gap-3")}>
          <div className="p-4 pb-0">
            <CompanyAvatar
              name={empresa.empresa}
              seed={empresa.id ?? empresa.empresa_id ?? empresa.empresaId ?? empresa.cnpj}
              className="h-12 w-12 rounded-2xl text-sm"
            />
          </div>
          <div className={cn("flex-1 min-w-0 p-4", isCompact ? "pb-0" : "pb-1")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold leading-tight text-slate-800">{empresa.empresa}</h3>
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

            <div
              className={cn(
                "mt-2 flex flex-wrap text-xs text-slate-600",
                isCompact ? "gap-1.5" : "gap-2"
              )}
            >
              <Chip>Categoria: {empresa.categoria || "—"}</Chip>
              <Chip
                variant={getStatusKey(empresa.certificado).includes("valido") ? "success" : "danger"}
              >
                Certificado: {empresa.certificado || DEFAULT_CERTIFICADO_SITUACAO}
              </Chip>
              <Chip
                variant={getStatusKey(empresa.debito).includes("sem debit") ? "success" : "neutral"}
                size={getStatusKey(empresa.debito).includes("sem debit") ? "md" : "sm"}
              >
                Débito: {empresa.debito}
              </Chip>
              {empresa.responsavelFiscal && <Chip>Resp. fiscal: {empresa.responsavelFiscal}</Chip>}
              {empresa.municipio && <Chip>Município: {empresa.municipio}</Chip>}
            </div>

            {(showContacts || showResponsaveis) && (
              <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                {showContacts && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Contatos</p>
                    {contactItems.map((item) => (
                      <p key={item.label}>
                        {item.label}: <span className="font-medium">{item.value}</span>
                      </p>
                    ))}
                  </div>
                )}
                {showResponsaveis && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Responsáveis</p>
                    {responsavelItems.map((item) => (
                      <p key={item.label}>
                        {item.label}: <span className="font-medium">{item.value}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div
          className={cn(
            "grid grid-cols-2 text-xs", 
            isCompact ? "gap-2 px-4 pb-2" : "gap-3 px-4 pb-3"
          )}
        >
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] uppercase text-slate-500 font-semibold">Licenças</p>
            <div className="mt-1 flex items-end gap-2 text-slate-800">
              <span className="text-2xl font-semibold">{licSummary.total}</span>
              <div className="space-y-0.5 text-[11px] text-slate-600">
                <p>Ativas: {licSummary.ativas}</p>
                <p>Vencendo: {licSummary.vencendo}</p>
                <p>Vencidas: {licSummary.vencidas}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] uppercase text-slate-500 font-semibold">Processos</p>
            <div className="mt-1 flex items-end gap-2 text-slate-800">
              <span className="text-2xl font-semibold">{processosEmpresa.length}</span>
              <div className="space-y-0.5 text-[11px] text-slate-600">
                <p>Ativos: {processosAtivosEmpresa.length}</p>
                <p>Encerrados: {processosEmpresa.length - processosAtivosEmpresa.length}</p>
                <p>
                  Taxas pend.:
                  {taxa ? TAXA_TYPE_KEYS.filter((key) => isAlertStatus(taxa?.[key])).length : 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div
          className={cn("flex flex-wrap gap-2 px-4", isCompact ? "pb-4 pt-1" : "pb-4 pt-2")}
        >
          {isCompact ? (
            <>
              {empresa.email && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(empresa.email, `E-mail copiado: ${empresa.email}`)}
                  className="text-xs"
                >
                  <Mail className="h-3.5 w-3.5 mr-1" /> Copiar e-mail
                </Button>
              )}
              {empresa.telefone && (
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
              )}
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
                    disabled={!hasValidCnpj}
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
                    disabled={!municipioInformado || !hasValidCnpj}
                    onClick={(event) => {
                      const originalEvent = event?.detail?.originalEvent;
                      const abrirPortal = Boolean(originalEvent?.ctrlKey || originalEvent?.metaKey);
                      emitirCNDMunicipal(empresa.cnpj, empresa.municipio, abrirPortal);
                    }}
                  />

                  <DropdownMenuItemFancy
                    icon={ExternalLink}
                    title={
                      <span className="inline-flex items-center">
                        CAE/FIC <MiniBadge>IM</MiniBadge>
                      </span>
                    }
                    description="Emitir a CAE/FIC de Anápolis."
                    hint={<Kbd>Ctrl</Kbd>}
                    disabled={!municipioAnapolis || !hasValidIM || !hasValidCnpj}
                    onClick={(event) => handleEmitirCAE(event, empresa)}
                  />

                  {/* próximos itens: CND Goiânia, CND Megasoft/Centi etc. */}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
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
                    disabled={!hasValidCnpj}
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
                    disabled={!municipioInformado || !hasValidCnpj}
                    onClick={(event) => {
                      const originalEvent = event?.detail?.originalEvent;
                      const abrirPortal = Boolean(originalEvent?.ctrlKey || originalEvent?.metaKey);
                      emitirCNDMunicipal(empresa.cnpj, empresa.municipio, abrirPortal);
                    }}
                  />

                  <DropdownMenuItemFancy
                    icon={ExternalLink}
                    title={
                      <span className="inline-flex items-center">
                        CAE/FIC <MiniBadge>IM</MiniBadge>
                      </span>
                    }
                    description="Emitir a CAE/FIC de Anápolis."
                    hint={<Kbd>Ctrl</Kbd>}
                    disabled={!municipioAnapolis || !hasValidIM || !hasValidCnpj}
                    onClick={(event) => handleEmitirCAE(event, empresa)}
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
                      let lista = cndEntry?.items;
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

                  <DropdownMenuItemFancy
                    icon={File}
                    title="CAE (Anápolis)"
                    description="Abrir a última CAE emitida."
                    disabled={cndLoading || !lastCAE}
                    hint={
                      cndLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                      ) : undefined
                    }
                    onClick={async () => {
                      let lista = cndEntry?.items;
                      if (!Array.isArray(lista) || lista.length === 0) {
                        lista = await ensureCNDs(empresa.cnpj, { force: true });
                      }

                      const arquivosCAE = Array.isArray(lista)
                        ? lista.filter((item) => item?.name?.startsWith("CAE - "))
                        : [];

                      if (!arquivosCAE.length) {
                        toast?.("Nenhuma CAE encontrada para esta empresa.");
                        return;
                      }

                      const arquivo = arquivosCAE[0];
                      if (arquivo?.url) {
                        window.open(ensureAbsoluteUrl(arquivo.url), "_blank", "noopener,noreferrer");
                      } else {
                        toast?.("Não foi possível localizar o arquivo da CAE.");
                      }
                    }}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
