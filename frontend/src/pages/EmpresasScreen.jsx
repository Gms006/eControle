import React from "react";
import { Button } from "@/components/ui/button";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Chip } from "@/components/Chip";
import ExportModal from "@/components/ExportModal";
import { Building2, CircleAlert, CircleCheckBig, CircleX, ShieldAlert, TrendingUp, X } from "lucide-react";
import { buildCertificadoIndex } from "@/lib/certificados";
import { apiUrl, fetchJson } from "@/lib/api";
import { onlyDigits } from "@/lib/quickLinks";
import useCompanyOverview from "@/hooks/useCompanyOverview";
import useCompanyRows from "@/hooks/companies/useCompanyRows";
import useCompanyFilters from "@/hooks/companies/useCompanyFilters";
import CompanyCard from "@/components/companies/CompanyCard";
import CompaniesFilterRail from "@/components/companies/CompaniesFilterRail";
import CompaniesKpiCards from "@/components/companies/CompaniesKpiCards";
import CompaniesTable from "@/components/companies/CompaniesTable";
import CompaniesToolbar from "@/components/companies/CompaniesToolbar";
import CompanyOverviewDrawer from "@/components/companies/CompanyOverviewDrawer";
import DomainSubnav from "@/components/navigation/DomainSubnav";

const VIEW_MODE_KEY = "econtrole.empresas.viewMode";

const resolveEmpresaIdValue = (empresa, extractEmpresaId) =>
  extractEmpresaId?.(empresa) ??
  empresa?.empresa_id ??
  empresa?.empresaId ??
  empresa?.company_id ??
  empresa?.companyId ??
  empresa?.id;

const companyDocumentValue = (item) => item?.cnpj || item?.company_cpf || "";

const isDebitoLabel = (value) => {
  const key = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (!key) return false;
  return key.includes("debito") || key.includes("debitos");
};

const parseIsActiveFlag = (empresa) => {
  const raw = empresa?.is_active ?? empresa?.isActive;
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (["t", "true", "1", "yes", "y", "sim", "ativo", "ativa"].includes(normalized)) return true;
  if (["f", "false", "0", "no", "n", "nao", "não", "inativo", "inativa"].includes(normalized)) return false;
  return null;
};

const resolveCompanyStatus = (empresa) => {
  const byFlag = parseIsActiveFlag(empresa);
  if (byFlag === true) return "Ativa";
  if (byFlag === false) return "Inativa";
  const fromStatusEmpresa = empresa?.status_empresa ?? empresa?.statusEmpresa;
  if (fromStatusEmpresa && !isDebitoLabel(fromStatusEmpresa)) return fromStatusEmpresa;
  const fromSituacao = empresa?.situacao;
  if (fromSituacao && !isDebitoLabel(fromSituacao)) return fromSituacao;
  if (empresa?.is_active === false || empresa?.isActive === false) return "Inativa";
  return "Ativa";
};

const formatRiskLabel = (value) => {
  const key = String(value || "").trim().toLowerCase();
  if (key === "high") return "Alto";
  if (key === "medium") return "Médio";
  if (key === "low") return "Baixo";
  return "—";
};

const formatScoreStatusLabel = (status, hasUsefulCnae) => {
  const key = String(status || "").trim().toUpperCase();
  if (!hasUsefulCnae && (key === "NO_CNAE" || key === "UNMAPPED_CNAE")) return "Sem CNAE";
  if (key === "OK") return "OK";
  if (key === "OK_DEFINITIVE") return "OK - Definitivo";
  if (key === "DEFINITIVE_INVALIDATED") return "Definitivo invalidado";
  if (key === "NO_CNAE") return "Sem CNAE";
  if (key === "UNMAPPED_CNAE") return "CNAE não mapeado";
  if (key === "NO_LICENCE") return "Sem licença datada";
  return "—";
};

const riskChipVariant = (risk) => {
  const key = String(risk || "").trim().toLowerCase();
  if (key === "HIGH") return "danger";
  if (key === "MEDIUM") return "warning";
  if (key === "LOW") return "success";
  return "neutral";
};

const CertificadoIcon = ({ bucket }) => {
  if (bucket === "valido") return <CircleCheckBig className="h-4 w-4 text-emerald-600" title="Válido" aria-label="Válido" />;
  if (bucket === "vencendo") return <CircleAlert className="h-4 w-4 text-orange-500" title="Vencendo" aria-label="Vencendo" />;
  return <CircleX className="h-4 w-4 text-rose-600" title="Sem certificado" aria-label="Sem certificado" />;
};

const isCompanyActive = (empresa) => {
  const byFlag = parseIsActiveFlag(empresa);
  if (byFlag !== null) return byFlag;
  const statusKey = String(resolveCompanyStatus(empresa) || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return statusKey.includes("ativ") && !statusKey.includes("inativ");
};

const formatDocumentMasked = (value) => {
  const digits = onlyDigits(value || "");
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return value || "—";
};

const resolveCompanyLegalName = (empresa) => String(empresa?.razao_social || empresa?.empresa || "—").trim() || "—";

const resolveCompanyTradeName = (empresa) => {
  const legal = resolveCompanyLegalName(empresa);
  const trade = String(empresa?.nome_fantasia || empresa?.empresa || "").trim();
  return trade && trade !== legal ? trade : "";
};

const statusChipClass = (isActive) => {
  if (!isActive) return "rounded-md border-blue-300 bg-blue-100 text-blue-900";
  return "rounded-md border-emerald-300 bg-emerald-100 text-emerald-900";
};

const valueChipClass = "rounded-md border";

export default function EmpresasScreen({
  filteredEmpresas,
  empresas,
  certificados,
  soAlertas,
  canManageEmpresas,
  extractEmpresaId,
  licencasByEmpresa,
  taxasByEmpresa,
  processosByEmpresa,
  handleCopy,
  enqueueToast,
  activeTab = "empresas",
  onTabChange,
}) {
  const toast = (msg) => enqueueToast?.(msg);

  const [viewMode, setViewMode] = React.useState(() => (
    typeof window !== "undefined" && window.localStorage.getItem(VIEW_MODE_KEY) === "detailed"
      ? "detailed"
      : "compact"
  ));
  const [openRailMobile, setOpenRailMobile] = React.useState(false);
  const [openExport, setOpenExport] = React.useState(false);
  const [cndCache, setCndCache] = React.useState({});
  const [openOverview, setOpenOverview] = React.useState(false);
  const [overviewCompany, setOverviewCompany] = React.useState(null);
  const cndRef = React.useRef(cndCache);
  const overviewState = useCompanyOverview(openOverview, overviewCompany?.id);

  React.useEffect(() => {
    cndRef.current = cndCache;
  }, [cndCache]);

  React.useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const certificadoIndex = React.useMemo(
    () => buildCertificadoIndex(Array.isArray(certificados) ? certificados : []),
    [certificados],
  );

  const ensureCNDs = React.useCallback(async (cnpjRaw, { force = false } = {}) => {
    const digits = onlyDigits(cnpjRaw || "");
    if (!digits) return [];
    const cached = cndRef.current[digits];
    if (!force && cached?.items) return cached.items;
    setCndCache((prev) => ({ ...prev, [digits]: { ...(prev[digits] || {}), loading: true } }));
    try {
      const items = await fetchJson(apiUrl(`/api/cnds/${digits}/list`), {
        transform: (payload) => (Array.isArray(payload) ? payload : []),
      });
      setCndCache((prev) => ({ ...prev, [digits]: { items, loading: false } }));
      return items;
    } catch {
      setCndCache((prev) => ({ ...prev, [digits]: { items: [], loading: false, error: true } }));
      toast?.("Não foi possível verificar as CNDs desta empresa.");
      return [];
    }
  }, [toast]);

  const openEditEmpresa = React.useCallback((empresa) => {
    const empresaId = resolveEmpresaIdValue(empresa, extractEmpresaId);
    window.dispatchEvent(
      new CustomEvent("econtrole:open-company", {
        detail: {
          mode: "edit",
          companyId: empresaId || null,
          cnpj: empresa?.cnpj || null,
          cpf: empresa?.company_cpf || null,
        },
      }),
    );
  }, [extractEmpresaId]);

  const openOverviewEmpresa = React.useCallback((empresa, empresaId) => {
    const resolvedId = empresaId || resolveEmpresaIdValue(empresa, extractEmpresaId);
    if (!resolvedId) {
      toast?.("Empresa sem identificador para abrir visão geral.");
      return;
    }
    setOverviewCompany({ ...(empresa || {}), id: String(resolvedId) });
    setOpenOverview(true);
  }, [extractEmpresaId, toast]);

  const rows = useCompanyRows({
    filteredEmpresas,
    extractEmpresaId,
    licencasByEmpresa,
    processosByEmpresa,
    taxasByEmpresa,
    certificadoIndex,
  });

  const {
    kpis,
    counts,
    summary,
    filteredRows,
    municipioOptions,
    porteOptions,
    responsavelOptions,
    sortOptions,
    activeFilterBadges,
    kpiFilter,
    setKpiFilter,
    statusFilter,
    setStatusFilter,
    riskFilters,
    setRiskFilters,
    certFilters,
    setCertFilters,
    municipioFilters,
    setMunicipioFilters,
    urgencyMin,
    setUrgencyMin,
    urgencyMax,
    setUrgencyMax,
    porteFilters,
    setPorteFilters,
    responsavelFilters,
    setResponsavelFilters,
    sortBy,
    clearRailFilters,
    toggleMultiFilter,
    handleRiskFilterClick,
    setSortField,
    toggleSortDirection,
    handleScoreSortQuickToggle,
    allRiskFilters,
  } = useCompanyFilters({
    rows,
    isCompanyActive,
    resolveCompanyStatus,
  });

  const kpiCards = React.useMemo(() => ([
    {
      key: "total",
      label: "Total de empresas",
      value: summary.totalCompanies,
      subtitle: `${summary.totalCompanies} no recorte atual`,
      icon: Building2,
    },
    {
      key: "ativas",
      label: "Empresas ativas",
      value: summary.activeCompanies,
      subtitle: `${summary.inactiveCompanies} inativas`,
      icon: TrendingUp,
    },
    {
      key: "riscoAlto",
      label: "Risco alto",
      value: summary.highRisk,
      subtitle: `${summary.highRiskPercent}% da base`,
      icon: ShieldAlert,
    },
    {
      key: "score",
      label: "Score médio",
      value: summary.avgScore ?? "—",
      subtitle: summary.scoredCompanies > 0 ? `${summary.scoredCompanies} empresas com score` : "Sem score calculado",
      icon: TrendingUp,
    },
  ]), [summary]);

  const rail = (
    <CompaniesFilterRail
      rowsCount={filteredRows.length}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      riskFilters={riskFilters}
      setRiskFilters={setRiskFilters}
      allRiskFilters={allRiskFilters}
      certFilters={certFilters}
      setCertFilters={setCertFilters}
      municipioFilters={municipioFilters}
      setMunicipioFilters={setMunicipioFilters}
      municipioOptions={municipioOptions}
      urgencyMin={urgencyMin}
      urgencyMax={urgencyMax}
      setUrgencyMin={setUrgencyMin}
      setUrgencyMax={setUrgencyMax}
      porteFilters={porteFilters}
      setPorteFilters={setPorteFilters}
      porteOptions={porteOptions}
      responsavelFilters={responsavelFilters}
      setResponsavelFilters={setResponsavelFilters}
      responsavelOptions={responsavelOptions}
      clearRailFilters={clearRailFilters}
      toggleMultiFilter={toggleMultiFilter}
      onRiskFilterClick={handleRiskFilterClick}
      activeCount={activeFilterBadges.length}
      kpis={kpis}
      counts={counts}
      kpiFilter={kpiFilter}
      setKpiFilter={setKpiFilter}
      includeRiskTestIds={false}
    />
  );

  return (
    <div className="space-y-4" data-testid="companies-summary">
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden xl:block">{rail}</div>
        <section className="space-y-4">
          <DomainSubnav activeTab={activeTab} onTabChange={onTabChange} />

          <div className="flex flex-wrap items-center gap-2">
            {activeFilterBadges.map((badge) => (
              <button
                key={badge.key}
                type="button"
                onClick={badge.onClear}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                title="Remover filtro"
              >
                {badge.label}
                <X className="h-3.5 w-3.5" />
              </button>
            ))}
            {activeFilterBadges.length === 0 ? (
              <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
                Sem filtros adicionais ativos
              </span>
            ) : null}
            {soAlertas ? <Chip variant="warning">Modo alertas ativo</Chip> : null}
          </div>

          <CompaniesKpiCards cards={kpiCards} />

          <CompaniesToolbar
            filteredCount={filteredRows.length}
            totalCount={empresas.length}
            sortOptions={sortOptions}
            sortBy={sortBy}
            setSortField={setSortField}
            toggleSortDirection={toggleSortDirection}
            handleScoreSortQuickToggle={handleScoreSortQuickToggle}
            onOpenFilters={() => setOpenRailMobile(true)}
            onOpenExport={() => setOpenExport(true)}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />

          {viewMode === "compact" ? (
            <CompaniesTable
              filteredRows={filteredRows}
              handleCopy={handleCopy}
              toast={toast}
              canManageEmpresas={canManageEmpresas}
              openOverviewEmpresa={openOverviewEmpresa}
              openEditEmpresa={openEditEmpresa}
              ensureCNDs={ensureCNDs}
              resolveCompanyLegalName={resolveCompanyLegalName}
              resolveCompanyTradeName={resolveCompanyTradeName}
              companyDocumentValue={companyDocumentValue}
              CopyOnlyValue={CopyOnlyValue}
              statusChipClass={statusChipClass}
              isCompanyActive={isCompanyActive}
              valueChipClass={valueChipClass}
              riskChipVariant={riskChipVariant}
              formatRiskLabel={formatRiskLabel}
              formatScoreStatusLabel={formatScoreStatusLabel}
              CertificadoIcon={CertificadoIcon}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="companies-grid">
              {filteredRows.map((row) => (
                <CompanyCard
                  key={row.rowKey}
                  row={row}
                  handleCopy={handleCopy}
                  toast={toast}
                  canManageEmpresas={canManageEmpresas}
                  openOverviewEmpresa={openOverviewEmpresa}
                  openEditEmpresa={openEditEmpresa}
                  ensureCNDs={ensureCNDs}
                  resolveCompanyLegalName={resolveCompanyLegalName}
                  resolveCompanyTradeName={resolveCompanyTradeName}
                  companyDocumentValue={companyDocumentValue}
                  CopyOnlyValue={CopyOnlyValue}
                  CopyInlineValue={CopyInlineValue}
                  InfoTile={InfoTile}
                  valueChipClass={valueChipClass}
                  riskChipVariant={riskChipVariant}
                  formatRiskLabel={formatRiskLabel}
                  statusChipClass={statusChipClass}
                  isCompanyActive={isCompanyActive}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <SideDrawer
        open={openRailMobile}
        onClose={() => setOpenRailMobile(false)}
        subtitle="Empresas"
        title="Rail de filtros"
        footer={(
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="border-blue-300 bg-blue-100 text-blue-900 hover:bg-blue-200" onClick={clearRailFilters}>Limpar</Button>
            <Button type="button" className="bg-slate-900 text-white hover:bg-slate-800" onClick={() => setOpenRailMobile(false)}>Aplicar</Button>
          </div>
        )}
      >
        <CompaniesFilterRail
          rowsCount={filteredRows.length}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          riskFilters={riskFilters}
          setRiskFilters={setRiskFilters}
          allRiskFilters={allRiskFilters}
          certFilters={certFilters}
          setCertFilters={setCertFilters}
          municipioFilters={municipioFilters}
          setMunicipioFilters={setMunicipioFilters}
          municipioOptions={municipioOptions}
          urgencyMin={urgencyMin}
          urgencyMax={urgencyMax}
          setUrgencyMin={setUrgencyMin}
          setUrgencyMax={setUrgencyMax}
          porteFilters={porteFilters}
          setPorteFilters={setPorteFilters}
          porteOptions={porteOptions}
          responsavelFilters={responsavelFilters}
          setResponsavelFilters={setResponsavelFilters}
          responsavelOptions={responsavelOptions}
          clearRailFilters={clearRailFilters}
          toggleMultiFilter={toggleMultiFilter}
          onRiskFilterClick={handleRiskFilterClick}
          activeCount={activeFilterBadges.length}
          kpis={kpis}
          counts={counts}
          kpiFilter={kpiFilter}
          setKpiFilter={setKpiFilter}
          includeRiskTestIds
        />
      </SideDrawer>

      <CompanyOverviewDrawer
        open={openOverview}
        onClose={() => {
          setOpenOverview(false);
          setOverviewCompany(null);
        }}
        company={overviewCompany}
        state={overviewState}
        onEditCompany={canManageEmpresas ? openEditEmpresa : undefined}
        onCopy={handleCopy}
      />

      <ExportModal open={openExport} onClose={() => setOpenExport(false)} enqueueToast={enqueueToast} />
    </div>
  );
}

function InfoTile({ title, value, icon: Icon }) {
  return (
    <div className="rounded-lg bg-slate-100/80 p-2.5">
      <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        <span>{title}</span>
      </p>
      <div className="mt-1 text-sm font-medium text-slate-800">{value || "-"}</div>
    </div>
  );
}

function CopyInlineValue({ value, onCopy }) {
  const text = String(value || "").trim();
  if (!text) return <span>-</span>;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onCopy?.(text, `${text} copiado`);
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      className="inline-flex items-center text-sm font-medium text-slate-800 transition hover:text-slate-900"
      title="Copiar valor"
    >
      {text}
    </button>
  );
}

function CopyOnlyValue({ value, onCopy }) {
  const text = String(value || "").trim();
  const formatted = formatDocumentMasked(text);
  const digits = onlyDigits(text);
  const isDocument = digits.length === 11 || digits.length === 14;
  if (!text) return <span className="text-xs text-slate-500">—</span>;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        const isCtrlClick = event.ctrlKey || event.metaKey;
        if (isDocument && isCtrlClick) {
          onCopy?.(digits, `${digits} copiado (sem máscara)`);
          return;
        }
        const toCopy = isDocument ? formatted : text;
        onCopy?.(toCopy, `${toCopy} copiado`);
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      className="inline-flex items-center whitespace-nowrap px-0 py-0 text-xs font-medium text-slate-700 transition hover:text-slate-900"
      title={isDocument ? "Copiar valor (Ctrl+clique sem máscara)" : "Copiar valor"}
    >
      {formatted}
    </button>
  );
}
