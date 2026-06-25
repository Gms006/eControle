import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import PageTitle from "@/components/layout/PageTitle";
import HeaderMenuPro from "@/components/header/HeaderMenuPro";
import CopilotWidget from "@/components/copilot/CopilotWidget";
import WorkerHealthDrawer from "@/components/layout/WorkerHealthDrawer";
import PainelScreen from "./PainelScreen";
import EmpresasScreen from "./EmpresasScreen";
import LicencasScreen from "./LicencasScreen";
import TaxasScreen from "./TaxasScreen";
import ProcessosScreen from "./ProcessosScreen";
import CertificadosScreen from "./CertificadosScreen";
import AutomacoesScreen from "./AutomacoesScreen";
import NotificacoesScreen from "./NotificacoesScreen";
import { useAuth } from "../hooks/useAuth";
import { fetchJson } from "../lib/api";
import { TAB_BACKGROUNDS } from "../lib/constants";
import { APP_NAV_ITEMS, TAB_TITLES, type AppTabKey } from "@/lib/theme";
import { normalizeText, removeDiacritics } from "../lib/text";
import { getStatusKey, isAlertStatus, isProcessStatusActiveOrPending } from "@/lib/domain/status/common";
import { extractTabFromRoutePath } from "@/lib/navigation";
import { listarEmpresas } from "../services/empresas";
import { listarGruposKPIs } from "../services/kpis";
import { contarNotificacoesNaoLidas } from "@/services/notifications";
import { normalizeEmpresaRecord as normalizeEmpresaRecordAdapter } from "@/lib/domain/adapters/empresas";
import {
  buildMunicipioOptions,
  buildTaxaLookupMaps,
  dedupeEmpresas,
  pickMunicipioValue,
} from "@/lib/domain/adapters/mainApp";
import {
  buildOperationCounts,
  buildPageChips,
  buildPanelHeaderStats,
  buildTopbarContext,
  hasCompanyAlert as hasCompanyAlertAdapter,
} from "@/lib/domain/adapters/mainAppView";
import {
  buildCompanyIndex as buildCompanyIndexAdapter,
  groupByCompanyId as groupByCompanyIdAdapter,
  hasActiveCompanyLink as hasActiveCompanyLinkAdapter,
  hasCompanyReference as hasCompanyReferenceAdapter,
  mapByCompanyId as mapByCompanyIdAdapter,
  normalizeCnpjDigits as normalizeCnpjDigitsAdapter,
  toCompanyIdKey as toCompanyIdKeyAdapter,
} from "@/lib/domain/indexes/companyIndex";
import { adaptTaxasRecords as adaptTaxasRecordsAdapter } from "@/lib/domain/adapters/taxas";
import { adaptLicencasRecords as adaptLicencasRecordsAdapter } from "@/lib/domain/adapters/licencas";
import {
  adaptProcessosRecords as adaptProcessosRecordsAdapter,
  normalizeProcesso as normalizeProcessoAdapter,
} from "@/lib/domain/adapters/processos";
import {
  fetchAllPages as fetchAllPagesAdapter,
  normalizeRolesList,
  readSettledCollection,
  readSettledValue,
} from "@/lib/domain/adapters/asyncCollections";
import {
  filterEmpresasCollection,
  filterLicencasCollection,
  matchesMunicipio,
  matchesQueryTokens,
} from "@/lib/domain/adapters/search";

const SEARCH_FIELDS = [
  { key: "all", label: "Tudo" },
  { key: "nome", label: "Empresa" },
  { key: "cnpj", label: "CNPJ" },
  { key: "protocolo", label: "Protocolo" },
];

const renderEmptyState = (title: string, message: string) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-600">
    <div className="text-base font-semibold text-slate-800">{title}</div>
    <p className="mt-1 text-sm text-slate-500">{message}</p>
  </div>
);

export default function MainApp() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AppTabKey>(() => {
    if (typeof window === "undefined") return "painel";
    const stored = window.localStorage.getItem("econtrole.tab");
    return APP_NAV_ITEMS.some((item) => item.key === stored) ? (stored as AppTabKey) : "painel";
  });
  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [municipio, setMunicipio] = useState("Todos");
  const [somenteAlertas, setSomenteAlertas] = useState(false);
  const [modoFoco, setModoFoco] = useState(false);

  const [empresas, setEmpresas] = useState<any[]>([]);
  const [licencas, setLicencas] = useState<any[]>([]);
  const [taxas, setTaxas] = useState<any[]>([]);
  const [processos, setProcessos] = useState<any[]>([]);
  const [certificados, setCertificados] = useState<any[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [municipiosApi, setMunicipiosApi] = useState<string[]>([]);
  const [currentRoles, setCurrentRoles] = useState<string[]>([]);

  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const [jobsDrawerOpen, setJobsDrawerOpen] = useState(false);
  const [workerHealth, setWorkerHealth] = useState<any | null>(null);
  const [workerHealthLoading, setWorkerHealthLoading] = useState(false);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);
  const [panelNavigation, setPanelNavigation] = useState<{
    id: number;
    tab: AppTabKey;
    preset?: Record<string, any> | null;
  } | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const tabScrollTopRef = useRef<Partial<Record<AppTabKey, number>>>({});

  const handleTabChange = useCallback((nextTab: AppTabKey) => {
    if (!nextTab || nextTab === tab) return;
    tabScrollTopRef.current[tab] = contentScrollRef.current?.scrollTop ?? 0;
    setTab(nextTab);
  }, [tab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("econtrole.tab", tab);
  }, [tab]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && /^\d$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const target = APP_NAV_ITEMS[index]?.key;
        if (target) {
          event.preventDefault();
          handleTabChange(target);
        }
      }
      if (event.altKey && event.key === "ArrowUp") {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleTabChange]);

  useEffect(() => {
    const savedScrollTop = tabScrollTopRef.current[tab] ?? 0;
    if (!contentScrollRef.current) return;
    requestAnimationFrame(() => {
      if (contentScrollRef.current) {
        contentScrollRef.current.scrollTop = savedScrollTop;
      }
    });
  }, [tab]);

  const loadAllData = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setErrors({});
    try {
      const [
        empresasResponse,
        licencasResponse,
        taxasResponse,
        processosResponse,
        certificadosResponse,
        kpisResponse,
        municipiosResponse,
        meResponse,
      ] = await Promise.allSettled([
        fetchAllPagesAdapter(
          ({ limit, offset, page }: { limit: number; offset: number; page: number }) =>
            listarEmpresas({ limit, size: limit, offset, page, include_inactive: true }),
          1000,
        ),
        fetchAllPagesAdapter(
          ({ limit, offset }: { limit: number; offset: number; page: number }) =>
            fetchJson("/api/v1/licencas", { query: { limit, offset } }),
        ),
        fetchAllPagesAdapter(
          ({ limit, offset }: { limit: number; offset: number; page: number }) =>
            fetchJson("/api/v1/taxas", { query: { limit, offset } }),
        ),
        fetchAllPagesAdapter(
          ({ limit, offset }: { limit: number; offset: number; page: number }) =>
            fetchJson("/api/v1/processos", { query: { limit, offset } }),
        ),
        fetchAllPagesAdapter(
          ({ limit, offset }: { limit: number; offset: number; page: number }) =>
            fetchJson("/api/v1/certificados", { query: { limit, offset } }),
        ),
        listarGruposKPIs({}),
        fetchJson("/api/v1/companies/municipios"),
        fetchJson("/api/v1/auth/me"),
      ]);

      const nextErrors: Record<string, string> = {};
      const empresasRaw = readSettledCollection({ result: empresasResponse, key: "empresas", errors: nextErrors });
      const empresasNormalized = dedupeEmpresas(empresasRaw, {
        normalizeEmpresaRecord: normalizeEmpresaRecordAdapter,
        normalizeCnpjDigits: normalizeCnpjDigitsAdapter,
      });
      const companyIndexes = buildCompanyIndexAdapter(empresasNormalized);
      const licencasRaw = readSettledCollection({ result: licencasResponse, key: "licencas", errors: nextErrors });
      const taxasRaw = readSettledCollection({ result: taxasResponse, key: "taxas", errors: nextErrors });
      const processosRaw = readSettledCollection({ result: processosResponse, key: "processos", errors: nextErrors });
      const certificadosRaw = readSettledCollection({ result: certificadosResponse, key: "certificados", errors: nextErrors });
      
      const licencasLinked = licencasRaw.filter((item: any) => hasActiveCompanyLinkAdapter(item, companyIndexes));
      const taxasLinked = taxasRaw.filter((item: any) => hasActiveCompanyLinkAdapter(item, companyIndexes));
      const processosLinked = processosRaw;
      const certificadosLinked = certificadosRaw.filter(
        (item: any) => !hasCompanyReferenceAdapter(item) || hasActiveCompanyLinkAdapter(item, companyIndexes),
      );

      const taxasAdaptadas = adaptTaxasRecordsAdapter(taxasLinked, companyIndexes);
      const { taxasByCompanyId, taxasByCnpj } = buildTaxaLookupMaps(
        taxasAdaptadas,
        normalizeCnpjDigitsAdapter,
      );

      setEmpresas(empresasNormalized);
      setLicencas(adaptLicencasRecordsAdapter(licencasLinked, companyIndexes));
      setTaxas(taxasAdaptadas);
      setProcessos(adaptProcessosRecordsAdapter(processosLinked, companyIndexes, taxasByCompanyId, taxasByCnpj));
      setCertificados(certificadosLinked);

      setKpis(
        readSettledValue({
          result: kpisResponse,
          fallback: {},
          key: "kpis",
          errors: nextErrors,
          errorMessage: "Falha ao carregar KPIs.",
          transform: (value: any) => value || {},
        }),
      );
      setMunicipiosApi(
        readSettledValue({
          result: municipiosResponse,
          fallback: [],
          transform: (value: any) => (Array.isArray(value) ? value.filter(Boolean) : []),
        }),
      );
      setCurrentRoles(
        readSettledValue({
          result: meResponse,
          fallback: [],
          transform: (value: any) => normalizeRolesList(value?.roles),
        }),
      );

      setErrors(nextErrors);
      return true;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!active) return;
      await loadAllData({ silent: false });
    })();
    return () => {
      active = false;
    };
  }, [loadAllData]);

  const loadAllDataWithScrollRestore = useCallback(async () => {
    const scrollTop = contentScrollRef.current?.scrollTop ?? 0;
    const ok = await loadAllData({ silent: true });
    if (contentScrollRef.current) {
      requestAnimationFrame(() => {
        if (contentScrollRef.current) {
          contentScrollRef.current.scrollTop = scrollTop;
          requestAnimationFrame(() => {
            if (contentScrollRef.current) {
              contentScrollRef.current.scrollTop = scrollTop;
            }
          });
        }
      });
    }
    return ok;
  }, [loadAllData]);

  const enqueueToast = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  const handleDashboardQueueOpen = useCallback(
    (payload: { tab: AppTabKey; preset?: Record<string, any> | null }) => {
      if (!payload?.tab) return;
      handleTabChange(payload.tab);
      setPanelNavigation({
        id: Date.now(),
        tab: payload.tab,
        preset: payload.preset ?? null,
      });
    },
    [handleTabChange],
  );

  const handleNotificationRouteNavigate = useCallback(
    (routePath: string) => {
      if (!routePath || typeof routePath !== "string") return;

      const tab = extractTabFromRoutePath(routePath, window.location.origin) as AppTabKey | null;
      if (tab) {
        handleTabChange(tab);
      }
      if (routePath.startsWith("/painel")) {
        navigate(routePath);
      } else if (!tab) {
        navigate("/painel");
      }
    },
    [handleTabChange, navigate],
  );

  const loadWorkerHealth = useCallback(async () => {
    setWorkerHealthLoading(true);
    try {
      const payload = await fetchJson("/api/v1/worker/health");
      setWorkerHealth(payload ?? null);
    } catch {
      setWorkerHealth(null);
    } finally {
      setWorkerHealthLoading(false);
    }
  }, []);

  const handleSidebarOperationAction = useCallback(
    (action: "notifications" | "critical_queues" | "saved_views" | "automation_jobs") => {
      if (action === "notifications") {
        handleTabChange("notificacoes");
        return;
      }
      if (action === "critical_queues") {
        handleTabChange("painel");
        setSomenteAlertas(true);
        window.dispatchEvent(new CustomEvent("econtrole:painel-focus", { detail: { target: "critical_queues" } }));
        return;
      }
      if (action === "saved_views") {
        handleTabChange("painel");
        window.dispatchEvent(new CustomEvent("econtrole:painel-focus", { detail: { target: "saved_views" } }));
        return;
      }
      handleTabChange("automacoes");
    },
    [handleTabChange],
  );

  const loadUnreadNotificationsCount = useCallback(async () => {
    try {
      const payload = await contarNotificacoesNaoLidas();
      setNotificationsUnreadCount(Number(payload?.unread_count || 0));
    } catch {
      setNotificationsUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    void loadUnreadNotificationsCount();
    const interval = window.setInterval(() => {
      void loadUnreadNotificationsCount();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [loadUnreadNotificationsCount]);

  useEffect(() => {
    const onRefresh = async () => {
      try {
        await loadAllDataWithScrollRestore();
        enqueueToast("Dados atualizados.");
      } catch {
        enqueueToast("Falha ao atualizar dados. Use Recarregar para tentar novamente.");
      }
    };
    window.addEventListener("econtrole:refresh-data", onRefresh);
    return () => window.removeEventListener("econtrole:refresh-data", onRefresh);
  }, [enqueueToast, loadAllDataWithScrollRestore]);

  const handleCopy = useCallback(
    async (value?: string, message?: string) => {
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        if (message) enqueueToast(message);
      } catch {
        enqueueToast("Não foi possível copiar para a área de transferência.");
      }
    },
    [enqueueToast],
  );

  const extractEmpresaId = useCallback((empresa: any) => toCompanyIdKeyAdapter(empresa), []);

  const municipios = useMemo(() => {
    return buildMunicipioOptions({
      municipiosApi,
      empresas,
      licencas,
      taxas,
      processos,
    });
  }, [empresas, licencas, municipiosApi, processos, taxas]);

  useEffect(() => {
    if (!municipios.includes(municipio)) {
      setMunicipio("Todos");
    }
  }, [municipio, municipios]);

  const matchesMunicipioFilter = useCallback(
    (item: any) => matchesMunicipio(item, municipio, pickMunicipioValue),
    [municipio],
  );

  const matchesQuery = useCallback(
    (values: any[], fieldMap: Record<string, any[]> = {}) => {
      return matchesQueryTokens(query, searchField, values, fieldMap);
    },
    [query, searchField],
  );

  const filterEmpresas = useCallback(
    (collection: any[]) =>
      filterEmpresasCollection(collection, {
        municipio,
        query,
        searchField,
        pickMunicipioValue,
      }),
    [municipio, query, searchField],
  );

  const filteredEmpresas = useMemo(
    () => filterEmpresas(empresas),
    [empresas, filterEmpresas],
  );

  const processosNormalizados = useMemo(
    () => processos.map(normalizeProcessoAdapter),
    [processos],
  );

  const licencasByEmpresa = useMemo(
    () => groupByCompanyIdAdapter(licencas, extractEmpresaId),
    [licencas, extractEmpresaId],
  );

  const taxasByEmpresa = useMemo(
    () => mapByCompanyIdAdapter(taxas, extractEmpresaId),
    [taxas, extractEmpresaId],
  );

  const processosByEmpresa = useMemo(
    () => groupByCompanyIdAdapter(processosNormalizados, extractEmpresaId),
    [processosNormalizados, extractEmpresaId],
  );

  const filteredLicencas = useMemo(
    () =>
      filterLicencasCollection(licencas, {
        matchesMunicipioFilter,
        matchesQuery,
      }),
    [licencas, matchesMunicipioFilter, matchesQuery],
  );

  const companyHasAlert = useCallback(
    (empresa: any) =>
      hasCompanyAlertAdapter({
        empresa,
        extractEmpresaId,
        licencasByEmpresa,
        taxasByEmpresa,
        processosByEmpresa,
      }),
    [extractEmpresaId, licencasByEmpresa, processosByEmpresa, taxasByEmpresa],
  );

  const backgroundClass = TAB_BACKGROUNDS[tab as keyof typeof TAB_BACKGROUNDS] || "bg-slate-50";
  const pageMeta = TAB_TITLES[tab];
  const activeNav = APP_NAV_ITEMS.find((item) => item.key === tab);
  const topbarContext = useMemo(
    () => buildTopbarContext({ tab, navItems: APP_NAV_ITEMS }),
    [tab],
  );
  const pageChips = useMemo(
    () => buildPageChips({ activeNav, somenteAlertas, modoFoco }),
    [activeNav, somenteAlertas, modoFoco],
  );
  const panelHeaderStats = useMemo(
    () =>
      buildPanelHeaderStats({
        empresasCount: empresas.length,
        licencasCount: licencas.length,
        taxasCount: taxas.length,
        municipio,
        somenteAlertas,
      }),
    [empresas.length, licencas.length, taxas.length, municipio, somenteAlertas],
  );
  const operationCounts = useMemo(
    () =>
      buildOperationCounts({
        errors,
        filteredLicencas,
        notificationsUnreadCount,
        processosNormalizados,
        workerHealth,
      }),
    [errors, filteredLicencas, notificationsUnreadCount, processosNormalizados, workerHealth],
  );

  return (
    <div className="ec-shell-root h-screen overflow-hidden bg-app">
      <div className="ec-shell-layout flex h-screen">
        <Sidebar
          items={APP_NAV_ITEMS}
          activeTab={tab}
          activeOperationKey={tab === "notificacoes" ? "notifications" : tab === "automacoes" ? "automation_jobs" : null}
          onTabChange={handleTabChange}
          onOperationAction={handleSidebarOperationAction}
          operationCounts={operationCounts}
          onLogout={() => void logout()}
        />

        <div className="ec-shell-main flex min-w-0 flex-1 flex-col">
          <Topbar
            items={APP_NAV_ITEMS}
            activeTab={tab}
            onTabChange={handleTabChange}
            query={query}
            onQueryChange={setQuery}
            searchField={searchField}
            onSearchFieldChange={setSearchField}
            searchFieldOptions={SEARCH_FIELDS}
            municipio={municipio}
            municipios={municipios}
            onMunicipioChange={setMunicipio}
            somenteAlertas={somenteAlertas}
            onSomenteAlertasChange={setSomenteAlertas}
            modoFoco={modoFoco}
            onModoFocoChange={setModoFoco}
            actions={<HeaderMenuPro currentRoles={currentRoles} />}
            onReload={() => {
              void loadAllDataWithScrollRestore();
            }}
            onLogout={() => void logout()}
            onNotificationRouteNavigate={handleNotificationRouteNavigate}
            panelHeaderStats={panelHeaderStats}
            headerContext={topbarContext}
          />

          <div ref={contentScrollRef} className={`min-w-0 flex-1 min-h-0 overflow-y-auto bg-app ${backgroundClass} ec-shell-content`}>
            <main className="mx-auto max-w-[1600px] px-4 py-4 lg:px-6 lg:py-5">
              {tab !== "painel" && tab !== "empresas" && tab !== "licencas" && tab !== "taxas" && tab !== "processos" && tab !== "automacoes" && tab !== "certificados" && tab !== "notificacoes" ? (
                <PageTitle
                  title={pageMeta.title}
                  subtitle={pageMeta.subtitle}
                  chips={pageChips}
                />
              ) : null}

              {/* TODO: o conteúdo da aba vem aqui embaixo (tabelas, cards etc) */}

              {loading && (
                <div className="rounded-3xl border border-subtle bg-surface p-6 text-sm text-slate-500 shadow-panel">
                  Carregando dados do backend...
                </div>
              )}

              <AnimatePresence mode="wait">
                {!loading && tab === "painel" && (
                  <motion.div
                    key="painel"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <PainelScreen
                      query={query}
                      municipio={municipio}
                      soAlertas={somenteAlertas}
                      modoFoco={modoFoco}
                      currentRoles={currentRoles}
                      kpis={kpis}
                      empresas={empresas}
                      licencas={licencas}
                      taxas={taxas}
                      certificados={certificados}
                      filteredLicencas={filteredLicencas}
                      processosNormalizados={processosNormalizados}
                      filterEmpresas={filterEmpresas}
                      companyHasAlert={companyHasAlert}
                      licencasByEmpresa={licencasByEmpresa}
                      extractEmpresaId={extractEmpresaId}
                      onOpenQueueTarget={handleDashboardQueueOpen}
                      activeTab={tab}
                      onTabChange={handleTabChange}
                    />
                  </motion.div>
                )}

                {!loading && tab === "empresas" && (
                  <motion.div
                    key="empresas"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <EmpresasScreen
                      filteredEmpresas={filteredEmpresas}
                      empresas={empresas}
                      certificados={certificados}
                      soAlertas={somenteAlertas}
                      canManageEmpresas={currentRoles.includes("ADMIN") || currentRoles.includes("DEV")}
                      extractEmpresaId={extractEmpresaId}
                      licencasByEmpresa={licencasByEmpresa}
                      taxasByEmpresa={taxasByEmpresa}
                      processosByEmpresa={processosByEmpresa}
                      handleCopy={handleCopy}
                      enqueueToast={enqueueToast}
                      activeTab={tab}
                      onTabChange={handleTabChange}
                    />
                  </motion.div>
                )}

                {!loading && tab === "certificados" && (
                  <motion.div
                    key="certificados"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <>
                      <CertificadosScreen
                        certificados={certificados}
                        modoFoco={modoFoco}
                        matchesMunicipioFilter={matchesMunicipioFilter}
                        matchesQuery={matchesQuery}
                        handleCopy={handleCopy}
                        panelPreset={panelNavigation?.tab === "certificados" ? panelNavigation : null}
                        activeTab={tab}
                        onTabChange={handleTabChange}
                      />
                      {errors.certificados &&
                        renderEmptyState("Erro ao carregar certificados", errors.certificados)}
                    </>
                  </motion.div>
                )}

                {!loading && tab === "licencas" && (
                  <motion.div
                    key="licencas"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <>
                      <LicencasScreen
                        licencas={licencas}
                        filteredLicencas={filteredLicencas}
                        empresas={empresas}
                        modoFoco={modoFoco}
                        canManageLicencas={currentRoles.includes("ADMIN") || currentRoles.includes("DEV")}
                        handleCopy={handleCopy}
                        enqueueToast={enqueueToast}
                        onRefreshData={loadAllData}
                        panelPreset={panelNavigation?.tab === "licencas" ? panelNavigation : null}
                        activeTab={tab}
                        onTabChange={handleTabChange}
                      />
                      {errors.licencas && renderEmptyState("Erro ao carregar licenças", errors.licencas)}
                    </>
                  </motion.div>
                )}

                {!loading && tab === "notificacoes" && (
                  <motion.div
                    key="notificacoes"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <NotificacoesScreen
                      enqueueToast={enqueueToast}
                      onNotificationRouteNavigate={handleNotificationRouteNavigate}
                      onUnreadCountChange={setNotificationsUnreadCount}
                    />
                  </motion.div>
                )}

                {!loading && tab === "taxas" && (
                  <motion.div
                    key="taxas"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <>
                      <TaxasScreen
                        taxas={taxas}
                        empresas={empresas}
                        certificados={certificados}
                        modoFoco={modoFoco}
                        soAlertas={somenteAlertas}
                        matchesMunicipioFilter={matchesMunicipioFilter}
                        matchesQuery={matchesQuery}
                        handleCopy={handleCopy}
                        canManageTaxas={currentRoles.includes("ADMIN") || currentRoles.includes("DEV")}
                        companyHasAlert={companyHasAlert}
                        activeTab={tab}
                        onTabChange={handleTabChange}
                        municipio={municipio}
                        query={query}
                      />
                      {errors.taxas && renderEmptyState("Erro ao carregar taxas", errors.taxas)}
                    </>
                  </motion.div>
                )}

                {!loading && tab === "processos" && (
                  <motion.div
                    key="processos"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <>
                      <ProcessosScreen
                        processosNormalizados={processosNormalizados}
                        empresas={empresas}
                        certificados={certificados}
                        modoFoco={modoFoco}
                        soAlertas={somenteAlertas}
                        matchesMunicipioFilter={matchesMunicipioFilter}
                        matchesQuery={matchesQuery}
                        handleCopy={handleCopy}
                        panelPreset={panelNavigation?.tab === "processos" ? panelNavigation : null}
                        activeTab={tab}
                        onTabChange={handleTabChange}
                        query={query}
                        onQueryChange={setQuery}
                        municipio={municipio}
                        searchField={searchField}
                        canManageProcessos={currentRoles.includes("ADMIN") || currentRoles.includes("DEV")}
                      />
                      {errors.processos && renderEmptyState("Erro ao carregar processos", errors.processos)}
                    </>
                  </motion.div>
                )}

                {!loading && tab === "automacoes" && (
                  <motion.div
                    key="automacoes"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <AutomacoesScreen
                      activeTab={tab}
                      onTabChange={handleTabChange}
                      enqueueToast={enqueueToast}
                      workerHealth={workerHealth}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </div>
        </div>
      </div>

      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="rounded-xl border border-subtle bg-card px-4 py-2 text-xs font-medium text-slate-700 shadow-lg"
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
      <WorkerHealthDrawer
        open={jobsDrawerOpen}
        onClose={() => setJobsDrawerOpen(false)}
        onRefresh={() => void loadWorkerHealth()}
        workerHealth={workerHealth}
        loading={workerHealthLoading}
      />
      <CopilotWidget roles={currentRoles as any} onNavigateRoute={handleNotificationRouteNavigate} />
    </div>
  );
}





