import React from "react";
import dayjs from "dayjs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItemFancy, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Chip } from "@/components/Chip";
import CompanyAvatar from "@/components/common/CompanyAvatar";
import StatusBadge from "@/components/StatusBadge";
import CopyableIdentifier from "@/components/CopyableIdentifier";
import { ArrowDownAZ, ArrowUpZA, Clipboard, EllipsisVertical, ExternalLink, File, Mail, PencilLine, Phone, SlidersHorizontal } from "lucide-react";
import { TAXA_TYPE_KEYS } from "@/lib/constants";
import { DEFAULT_CERTIFICADO_SITUACAO } from "@/lib/certificados";
import { parseDateLike } from "@/lib/date";
import { cn } from "@/lib/utils";
import { getStatusKey, hasRelevantStatus, isAlertStatus, isProcessStatusInactive } from "@/lib/status";
import { openCartaoCNPJ, onlyDigits } from "@/lib/quickLinks";

const VIEW_MODE_KEY = "econtrole.empresas.viewMode";

const resolveApiBaseUrl = () => {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window === "undefined") return "";
  const { protocol, hostname, port } = window.location;
  if (port === "5173") return `${protocol}//${hostname}:8000`;
  if (port === "5174") return `${protocol}//${hostname}:8020`;
  return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
};
const API_BASE_URL = resolveApiBaseUrl();
const ensureAbsoluteUrl = (url) => {
  if (!url) return "";
  if (/^https?:/i.test(url)) return url;
  const normalized = url.startsWith("/") ? url : `/${url}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
};
const resolveEmpresaIdValue = (empresa, extractEmpresaId) =>
  extractEmpresaId?.(empresa) ??
  empresa?.empresa_id ??
  empresa?.empresaId ??
  empresa?.company_id ??
  empresa?.companyId ??
  empresa?.id;
const companyCnpjDigits = (item) =>
  onlyDigits(item?.cnpj ?? item?.cnpj_empresa ?? item?.cnpjEmpresa ?? "");
const findListByEmpresa = (map, empresaId, empresaCnpj) => {
  if (empresaId && map?.has(empresaId)) return map.get(empresaId) || [];
  const target = onlyDigits(empresaCnpj || "");
  if (!target) return [];
  for (const value of map?.values?.() || []) {
    const list = Array.isArray(value) ? value : [value];
    const matched = list.filter((entry) => companyCnpjDigits(entry) === target);
    if (matched.length > 0) return matched;
  }
  return [];
};
const findTaxaByEmpresa = (map, empresaId, empresaCnpj) => {
  if (empresaId && map?.has(empresaId)) return map.get(empresaId);
  const target = onlyDigits(empresaCnpj || "");
  if (!target) return undefined;
  for (const taxa of map?.values?.() || []) {
    if (companyCnpjDigits(taxa) === target) return taxa;
  }
  return undefined;
};

const hasDebito = (empresa) => {
  const key = getStatusKey(empresa?.debito || "");
  return key.includes("possui") || key.includes("debito") || isAlertStatus(empresa?.debito);
};
const semCertificado = (empresa) => !getStatusKey(empresa?.certificado || "").includes("valid");
const critico7dias = (lics) =>
  (lics || []).some((lic) => {
    const parsed = parseDateLike(lic?.validade || lic?.validade_br);
    if (!parsed) return false;
    const days = parsed.startOf("day").diff(dayjs().startOf("day"), "day");
    return days >= 0 && days <= 7;
  });

export default function EmpresasScreen({
  filteredEmpresas,
  empresas,
  soAlertas,
  canManageEmpresas,
  extractEmpresaId,
  licencasByEmpresa,
  taxasByEmpresa,
  processosByEmpresa,
  handleCopy,
  enqueueToast,
}) {
  const toast = (msg) => enqueueToast?.(msg);
  const [viewMode, setViewMode] = React.useState(() => (typeof window !== "undefined" && window.localStorage.getItem(VIEW_MODE_KEY) === "detailed" ? "detailed" : "compact"));
  const [openFilters, setOpenFilters] = React.useState(false);
  const [kpiFilter, setKpiFilter] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState("todos");
  const [sortBy, setSortBy] = React.useState({ field: "nome", direction: "asc" });
  const [cndCache, setCndCache] = React.useState({});
  const cndRef = React.useRef(cndCache);

  React.useEffect(() => {
    cndRef.current = cndCache;
  }, [cndCache]);
  React.useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const ensureCNDs = React.useCallback(async (cnpjRaw, { force = false } = {}) => {
    const digits = onlyDigits(cnpjRaw || "");
    if (!digits) return [];
    const cached = cndRef.current[digits];
    if (!force && cached?.items) return cached.items;
    setCndCache((prev) => ({ ...prev, [digits]: { ...(prev[digits] || {}), loading: true } }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/cnds/${digits}/list`);
      const items = response.ok ? await response.json() : [];
      setCndCache((prev) => ({ ...prev, [digits]: { items, loading: false } }));
      return items;
    } catch {
      setCndCache((prev) => ({ ...prev, [digits]: { items: [], loading: false, error: true } }));
      toast?.("Não foi possível verificar as CNDs desta empresa.");
      return [];
    }
  }, [toast]);

  const openEditEmpresa = React.useCallback((empresaId) => {
    if (!empresaId) return;
    window.dispatchEvent(new CustomEvent("econtrole:open-company", { detail: { mode: "edit", companyId: empresaId } }));
  }, []);

  const rows = React.useMemo(() => filteredEmpresas.map((empresa) => {
    const empresaId = resolveEmpresaIdValue(empresa, extractEmpresaId);
    const lics = findListByEmpresa(licencasByEmpresa, empresaId, empresa?.cnpj);
    const processos = findListByEmpresa(processosByEmpresa, empresaId, empresa?.cnpj);
    const taxa = findTaxaByEmpresa(taxasByEmpresa, empresaId, empresa?.cnpj);
    const ativos = processos.filter((proc) => !isProcessStatusInactive(proc.status));
    const licSummary = lics.reduce((acc, lic) => {
      if (!hasRelevantStatus(lic.status)) return acc;
      const key = getStatusKey(lic.status);
      acc.total += 1;
      if (key.includes("vencid")) acc.vencidas += 1;
      else if (key.includes("vence")) acc.vencendo += 1;
      else acc.ativas += 1;
      return acc;
    }, { total: 0, ativas: 0, vencendo: 0, vencidas: 0 });
    const taxaPendencias = taxa ? TAXA_TYPE_KEYS.filter((key) => isAlertStatus(taxa?.[key])).length : 0;
    return {
      empresa,
      empresaId: empresaId ? String(empresaId) : undefined,
      lics,
      licSummary,
      processos,
      ativos,
      taxaPendencias,
      flags: {
        debitos: hasDebito(empresa),
        semCertificado: semCertificado(empresa),
        taxasPendentes: taxaPendencias > 0,
        licencasVencendo: licSummary.vencendo > 0 || licSummary.vencidas > 0,
        processosAndamento: ativos.length > 0,
        criticos7dias: critico7dias(lics),
      },
    };
  }), [extractEmpresaId, filteredEmpresas, licencasByEmpresa, processosByEmpresa, taxasByEmpresa]);

  const kpis = [
    { key: "debitos", label: "Com débitos" },
    { key: "semCertificado", label: "Sem certificado" },
    { key: "taxasPendentes", label: "Taxas pendentes" },
    { key: "licencasVencendo", label: "Licenças vencendo" },
    { key: "processosAndamento", label: "Processos em andamento" },
    { key: "criticos7dias", label: "Críticos (<=7 dias)" },
  ];
  const counts = Object.fromEntries(kpis.map((item) => [item.key, rows.filter((row) => row.flags[item.key]).length]));

  const filteredRows = React.useMemo(() => {
    const list = rows.filter((row) => {
      if (kpiFilter && !row.flags[kpiFilter]) return false;
      const statusKey = getStatusKey(row.empresa?.situacao || "");
      if (statusFilter === "ativa" && !statusKey.includes("ativ")) return false;
      if (statusFilter === "inativa" && statusKey.includes("ativ")) return false;
      return true;
    });
    list.sort((a, b) => {
      const av = sortBy.field === "status" ? getStatusKey(a.empresa?.situacao || "") : String(a.empresa?.empresa || "").toLowerCase();
      const bv = sortBy.field === "status" ? getStatusKey(b.empresa?.situacao || "") : String(b.empresa?.empresa || "").toLowerCase();
      return av.localeCompare(bv) * (sortBy.direction === "asc" ? 1 : -1);
    });
    return list;
  }, [kpiFilter, rows, sortBy.direction, sortBy.field, statusFilter]);

  const toggleSort = (field) => setSortBy((prev) => prev.field === field ? { field, direction: prev.direction === "asc" ? "desc" : "asc" } : { field, direction: "asc" });

  return (
    <div className="space-y-3">
      <Card className="border-subtle bg-surface" data-testid="companies-summary">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted">{filteredRows.length} de {empresas.length} empresas exibidas</span>
            <div className="flex items-center gap-2">
              {soAlertas ? <Chip variant="warning">Modo alertas ativo</Chip> : null}
              <Button size="sm" variant="outline" className="border-subtle" onClick={() => setOpenFilters(true)}>
                <SlidersHorizontal className="mr-1 h-3.5 w-3.5" /> Filtros avançados
              </Button>
              <div className="inline-flex items-center rounded-xl border border-subtle bg-card p-1">
                <button type="button" onClick={() => setViewMode("compact")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", viewMode === "compact" ? "bg-slate-900 text-white" : "text-slate-600")}>Compacto</button>
                <button type="button" onClick={() => setViewMode("detailed")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", viewMode === "detailed" ? "bg-slate-900 text-white" : "text-slate-600")}>Detalhado</button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {kpis.map((item) => (
              <button key={item.key} type="button" onClick={() => setKpiFilter((prev) => (prev === item.key ? null : item.key))} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", kpiFilter === item.key ? "border-blue-200 bg-blue-50 text-blue-800" : "border-subtle bg-card text-slate-600")}>
                {item.label} <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px]">{counts[item.key] || 0}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      {viewMode === "compact" ? (
        <Card className="overflow-hidden border-subtle bg-card" data-testid="companies-grid">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-100/70">
                <TableRow>
                  <TableHead>
                    <SortButton label="Nome" active={sortBy.field === "nome"} direction={sortBy.direction} onClick={() => toggleSort("nome")} />
                  </TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Município</TableHead>
                  <TableHead>
                    <SortButton label="Status" active={sortBy.field === "status"} direction={sortBy.direction} onClick={() => toggleSort("status")} />
                  </TableHead>
                  <TableHead>Débitos</TableHead>
                  <TableHead>Certificado</TableHead>
                  <TableHead>Pendências</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow
                    key={row.empresaId ?? row.empresa?.id ?? row.empresa?.cnpj}
                    className="hover:shadow-[inset_0_0_0_1px_rgba(37,99,235,0.15)]"
                    data-testid="company-card"
                  >
                    <TableCell className="font-medium text-slate-900">{row.empresa?.empresa || "—"}</TableCell>
                    <TableCell>{row.empresa?.cnpj || "—"}</TableCell>
                    <TableCell>{row.empresa?.municipio || "—"}</TableCell>
                    <TableCell><StatusBadge status={row.empresa?.situacao || "Ativa"} /></TableCell>
                    <TableCell><Chip variant={row.flags.debitos ? "warning" : "success"}>{row.flags.debitos ? "Com" : "Sem"}</Chip></TableCell>
                    <TableCell><StatusBadge status={row.empresa?.certificado || DEFAULT_CERTIFICADO_SITUACAO} /></TableCell>
                    <TableCell><Chip variant={row.taxaPendencias > 0 ? "warning" : "neutral"}>{row.taxaPendencias}</Chip></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="outline"><EllipsisVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-72">
                          {canManageEmpresas ? (
                            <DropdownMenuItemFancy icon={PencilLine} title="Editar empresa" description="Abrir cadastro da empresa" onClick={() => openEditEmpresa(resolveEmpresaIdValue(row.empresa, extractEmpresaId))} />
                          ) : null}
                          <DropdownMenuItemFancy icon={ExternalLink} title="Cartão CNPJ" description="Abrir site da RFB" onClick={() => openCartaoCNPJ(row.empresa?.cnpj, toast)} />
                          {row.empresa?.email ? <DropdownMenuItemFancy icon={Mail} title="Copiar e-mail" description={row.empresa.email} onClick={() => handleCopy(row.empresa.email, `E-mail copiado: ${row.empresa.email}`)} /> : null}
                          {row.empresa?.telefone ? <DropdownMenuItemFancy icon={Phone} title="Copiar telefone" description={row.empresa.telefone} onClick={() => handleCopy(row.empresa.telefone, `Telefone copiado: ${row.empresa.telefone}`)} /> : null}
                          <DropdownMenuItemFancy icon={File} title="Atualizar certidões" description="Buscar últimas CNDs" onClick={() => ensureCNDs(row.empresa?.cnpj, { force: true })} />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2" data-testid="companies-grid">
          {filteredRows.map((row) => (
            <Card key={row.empresaId ?? row.empresa?.id ?? row.empresa?.cnpj} className="border-subtle bg-card transition hover:border-strong hover:shadow-card-hover focus-within:ring-2 focus-within:ring-blue-300" data-testid="company-card">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <CompanyAvatar name={row.empresa?.empresa} seed={row.empresa?.id ?? row.empresa?.cnpj} className="h-12 w-12 rounded-2xl text-sm" />
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-primary">{row.empresa?.empresa}</h3>
                        <StatusBadge status={row.empresa?.situacao || "Ativa"} />
                        {row.flags.debitos ? <Chip variant="warning">Possui débitos</Chip> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <CopyableIdentifier label="CNPJ" value={row.empresa?.cnpj} onCopy={handleCopy} />
                        <span>•</span>
                        <CopyableIdentifier label="IE" value={row.empresa?.ie} onCopy={handleCopy} />
                        <span>•</span>
                        <CopyableIdentifier label="IM" value={row.empresa?.im} onCopy={handleCopy} />
                        <span>• {row.empresa?.municipio || "—"}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <Chip>Categoria: {row.empresa?.categoria || "—"}</Chip>
                        <Chip variant={isAlertStatus(row.empresa?.certificado) ? "warning" : "success"}>Certificado: {row.empresa?.certificado || DEFAULT_CERTIFICADO_SITUACAO}</Chip>
                        {row.empresa?.responsavelFiscal ? <Chip>Resp. fiscal: {row.empresa.responsavelFiscal}</Chip> : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {row.empresa?.email ? <Button size="icon" variant="outline" title="Copiar e-mail" onClick={() => handleCopy(row.empresa.email, `E-mail copiado: ${row.empresa.email}`)}><Mail className="h-4 w-4" /></Button> : null}
                    {row.empresa?.telefone ? <Button size="icon" variant="outline" title="Copiar telefone" onClick={() => handleCopy(row.empresa.telefone, `Telefone copiado: ${row.empresa.telefone}`)}><Phone className="h-4 w-4" /></Button> : null}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <MiniCounter title="Licenças" main={row.licSummary.total} sub1={`Vencendo: ${row.licSummary.vencendo}`} sub2={`Vencidas: ${row.licSummary.vencidas}`} />
                  <MiniCounter title="Processos" main={row.processos.length} sub1={`Ativos: ${row.ativos.length}`} sub2={`Encerrados: ${row.processos.length - row.ativos.length}`} />
                  <MiniCounter title="Taxas" main={row.taxaPendencias} sub1="Pendências" sub2={row.taxaPendencias > 0 ? "Atenção" : "Em dia"} />
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-subtle pt-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="sm"><Clipboard className="mr-1.5 h-3.5 w-3.5" /> Ações rápidas</Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
                      <DropdownMenuItemFancy icon={ExternalLink} title="Cartão CNPJ" description="Abrir site da RFB" onClick={() => openCartaoCNPJ(row.empresa?.cnpj, toast)} />
                      <DropdownMenuItemFancy icon={File} title="Atualizar certidões" description="Buscar últimas CNDs" onClick={() => ensureCNDs(row.empresa?.cnpj, { force: true })} />
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {canManageEmpresas ? (
                    <Button size="sm" variant="outline" onClick={() => openEditEmpresa(resolveEmpresaIdValue(row.empresa, extractEmpresaId))} data-testid="company-edit-button"><PencilLine className="mr-1.5 h-3.5 w-3.5" /> Editar</Button>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline"><File className="mr-1.5 h-3.5 w-3.5" /> Certidões</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
                      <DropdownMenuItemFancy icon={File} title="Atualizar certidões" description="Buscar CNDs no backend" onClick={() => ensureCNDs(row.empresa?.cnpj, { force: true })} />
                      <DropdownMenuItemFancy
                        icon={File}
                        title="Abrir última CND"
                        description="Abre o arquivo mais recente disponível"
                        onClick={async () => {
                          const cnpjDigits = onlyDigits(row.empresa?.cnpj || "");
                          const cached = cndRef.current?.[cnpjDigits]?.items;
                          const items = Array.isArray(cached) && cached.length > 0 ? cached : await ensureCNDs(row.empresa?.cnpj, { force: true });
                          const first = items?.[0];
                          if (first?.url) window.open(ensureAbsoluteUrl(first.url), "_blank", "noopener,noreferrer");
                          else toast?.("Nenhuma CND encontrada para esta empresa.");
                        }}
                      />
                      <DropdownMenuItemFancy
                        icon={File}
                        title="Abrir última CAE"
                        description="Somente quando houver arquivo CAE"
                        onClick={async () => {
                          const cnpjDigits = onlyDigits(row.empresa?.cnpj || "");
                          const cached = cndRef.current?.[cnpjDigits]?.items;
                          const items = Array.isArray(cached) && cached.length > 0 ? cached : await ensureCNDs(row.empresa?.cnpj, { force: true });
                          const cae = (items || []).find((item) => item?.name?.startsWith("CAE - "));
                          if (cae?.url) window.open(ensureAbsoluteUrl(cae.url), "_blank", "noopener,noreferrer");
                          else toast?.("Nenhuma CAE encontrada para esta empresa.");
                        }}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <details className="rounded-xl border border-subtle bg-slate-50/80 p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">Mais Detalhes</summary>
                  <div className="mt-2 space-y-1 text-xs text-slate-700">
                    {(row.empresa?.observacoes || "").trim() ? <p><span className="font-semibold">Observação:</span> {row.empresa.observacoes}</p> : null}
                    {(Boolean(row.empresa?.endereco_fiscal ?? row.empresa?.enderecoFiscal) || Boolean(row.empresa?.holding) || Boolean(row.empresa?.mei ?? row.empresa?.is_mei ?? row.empresa?.isMei)) ? (
                      <div className="flex flex-wrap gap-1.5">
                        {Boolean(row.empresa?.endereco_fiscal ?? row.empresa?.enderecoFiscal) ? <Chip variant="neutral">Endereço Fiscal</Chip> : null}
                        {Boolean(row.empresa?.holding) ? <Chip variant="neutral">Holding</Chip> : null}
                        {Boolean(row.empresa?.mei ?? row.empresa?.is_mei ?? row.empresa?.isMei) ? <Chip variant="neutral">MEI</Chip> : null}
                      </div>
                    ) : null}
                    {Array.isArray(row.empresa?.cnaes_principal) && row.empresa.cnaes_principal.length > 0 ? <p><span className="font-semibold">CNAE principal:</span> {row.empresa.cnaes_principal.map((entry) => [entry?.code, entry?.text].filter(Boolean).join(" - ")).join(" | ")}</p> : null}
                    {Array.isArray(row.empresa?.cnaes_secundarios) && row.empresa.cnaes_secundarios.length > 0 ? <p><span className="font-semibold">CNAEs secundários:</span> {row.empresa.cnaes_secundarios.map((entry) => [entry?.code, entry?.text].filter(Boolean).join(" - ")).join(" | ")}</p> : null}
                  </div>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <SideDrawer
        open={openFilters}
        onClose={() => setOpenFilters(false)}
        subtitle="Empresas"
        title="Filtros avançados da aba"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="border-subtle" onClick={() => { setStatusFilter("todos"); setKpiFilter(null); }}>Limpar</Button>
            <Button type="button" onClick={() => setOpenFilters(false)}>Aplicar</Button>
          </div>
        }
      >
        <SimpleFilterRow
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "todos", label: "Todos" },
            { value: "ativa", label: "Ativas" },
            { value: "inativa", label: "Inativas" },
          ]}
        />
      </SideDrawer>
    </div>
  );
}

function SimpleFilterRow({ label, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={option.value} type="button" onClick={() => onChange(option.value)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", value === option.value ? "border-blue-200 bg-blue-50 text-blue-800" : "border-subtle bg-card text-slate-600")}>{option.label}</button>
        ))}
      </div>
    </div>
  );
}

function MiniCounter({ title, main, sub1, sub2 }) {
  return (
    <div className="rounded-xl border border-subtle bg-surface px-2.5 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="mt-1 text-xl font-semibold text-slate-900">{main}</div>
      <p className="text-[11px] text-slate-600">{sub1}</p>
      <p className="text-[11px] text-slate-600">{sub2}</p>
    </div>
  );
}

function SortButton({ label, active, direction, onClick }) {
  return (
    <button type="button" className="inline-flex items-center gap-1 font-semibold text-muted hover:text-slate-800" onClick={onClick}>
      {label}
      {active ? (direction === "asc" ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowUpZA className="h-3.5 w-3.5" />) : null}
    </button>
  );
}
