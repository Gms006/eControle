import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
} from "lucide-react";
import HeaderMenuPro from "../components/HeaderMenuPro";
import PainelScreen from "./PainelScreen";
import EmpresasScreen from "./EmpresasScreen";
import LicencasScreen from "./LicencasScreen";
import TaxasScreen from "./TaxasScreen";
import ProcessosScreen from "./ProcessosScreen";
import { useAuth } from "../hooks/useAuth";
import { fetchJson } from "../lib/api";
import { TAB_BACKGROUNDS } from "../lib/constants";
import { normalizeText, removeDiacritics } from "../lib/text";
import { getStatusKey, isAlertStatus, isProcessStatusActiveOrPending } from "../lib/status";
import { listarEmpresas } from "../services/empresas";
import { listarGruposKPIs } from "../services/kpis";

const NAV_ITEMS = [
  { key: "painel", label: "Painel", icon: LayoutDashboard },
  { key: "empresas", label: "Empresas", icon: Building2 },
  { key: "licencas", label: "Licenças", icon: FileText },
  { key: "taxas", label: "Taxas", icon: Receipt },
  { key: "processos", label: "Processos", icon: Settings },
];

const SEARCH_FIELDS = [
  { key: "all", label: "Tudo" },
  { key: "nome", label: "Empresa" },
  { key: "cnpj", label: "CNPJ" },
  { key: "protocolo", label: "Protocolo" },
];

const normalizeKey = (value: unknown) => {
  const normalized = removeDiacritics(normalizeText(value)).toLowerCase();
  return normalized.trim();
};

const normalizeItems = (payload: any) => {
  if (Array.isArray(payload)) return payload;
  if (payload?.items && Array.isArray(payload.items)) return payload.items;
  return [];
};

const normalizeProcesso = (proc: any) => ({
  ...proc,
  empresa:
    proc?.empresa ??
    proc?.razao_social ??
    proc?.razaoSocial ??
    proc?.nome_fantasia ??
    proc?.nomeFantasia ??
    proc?.razao ??
    proc?.nome ??
    "—",
  cnpj: proc?.cnpj ?? proc?.cnpj_empresa ?? proc?.cnpjEmpresa,
  municipio:
    proc?.municipio ??
    proc?.municipio_exibicao ??
    proc?.municipioExibicao ??
    proc?.municipio_nome ??
    proc?.municipioNome,
  situacao: proc?.situacao ?? proc?.status ?? proc?.status_padrao,
  status: proc?.status ?? proc?.situacao ?? proc?.status_padrao,
  tipo: proc?.tipo ?? proc?.tipo_processo ?? proc?.tipoProcesso,
});

const renderEmptyState = (title: string, message: string) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-600">
    <div className="text-base font-semibold text-slate-800">{title}</div>
    <p className="mt-1 text-sm text-slate-500">{message}</p>
  </div>
);

export default function MainApp() {
  const { logout } = useAuth();
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "painel";
    return window.localStorage.getItem("econtrole.tab") || "painel";
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
  const [notFound, setNotFound] = useState<Record<string, boolean>>({
    licencas: false,
    taxas: false,
    processos: false,
  });

  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("econtrole.tab", tab);
  }, [tab]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && /^[1-5]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const target = NAV_ITEMS[index]?.key;
        if (target) {
          event.preventDefault();
          setTab(target);
        }
      }
      if (event.altKey && event.key === "ArrowUp") {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setErrors({});
      try {
        const [
          empresasResponse,
          licencasResponse,
          taxasResponse,
          processosResponse,
          certificadosResponse,
          kpisResponse,
        ] = await Promise.allSettled([
          listarEmpresas({ limit: 1000 }),
          fetchJson("/api/v1/licencas", { query: { limit: 1000 } }),
          fetchJson("/api/v1/taxas", { query: { limit: 1000 } }),
          fetchJson("/api/v1/processos", { query: { limit: 1000 } }),
          fetchJson("/api/v1/certificados", { query: { limit: 1000 } }),
          listarGruposKPIs({}),
        ]);

        if (!active) return;

        const nextErrors: Record<string, string> = {};
        const nextNotFound: Record<string, boolean> = {
          licencas: false,
          taxas: false,
          processos: false,
        };

        const handleCollection = (
          result: PromiseSettledResult<any>,
          setter: (items: any[]) => void,
          key?: keyof typeof nextNotFound,
        ) => {
          if (result.status === "fulfilled") {
            const payload = result.value;
            if (key && payload?.__notFound) {
              nextNotFound[key] = true;
              setter([]);
              return;
            }
            setter(normalizeItems(payload));
          } else {
            const message = result.reason?.message || "Falha ao carregar dados.";
            if (key) {
              nextErrors[key] = message;
            }
            setter([]);
          }
        };

        handleCollection(empresasResponse, setEmpresas);
        handleCollection(licencasResponse, setLicencas, "licencas");
        handleCollection(taxasResponse, setTaxas, "taxas");
        handleCollection(processosResponse, setProcessos, "processos");
        handleCollection(certificadosResponse, setCertificados);

        if (kpisResponse.status === "fulfilled") {
          setKpis(kpisResponse.value || {});
        } else {
          nextErrors.kpis = kpisResponse.reason?.message || "Falha ao carregar KPIs.";
          setKpis({});
        }

        setErrors(nextErrors);
        setNotFound(nextNotFound);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const enqueueToast = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

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

  const extractEmpresaId = useCallback((empresa: any) => {
    const idCandidate = empresa?.empresa_id ?? empresa?.empresaId ?? empresa?.id;
    if (idCandidate === undefined || idCandidate === null) return undefined;
    const parsed = Number(idCandidate);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, []);

  const municipios = useMemo(() => {
    const entries = new Set<string>();
    [empresas, licencas, taxas, processos].forEach((collection) => {
      collection.forEach((item) => {
        const value =
          item?.municipio ??
          item?.municipio_exibicao ??
          item?.municipioExibicao ??
          item?.municipio_nome ??
          item?.municipioNome;
        if (value) {
          entries.add(String(value).trim());
        }
      });
    });
    const list = Array.from(entries).filter(Boolean).sort((a, b) => a.localeCompare(b));
    return ["Todos", ...list];
  }, [empresas, licencas, taxas, processos]);

  useEffect(() => {
    if (!municipios.includes(municipio)) {
      setMunicipio("Todos");
    }
  }, [municipio, municipios]);

  const matchesMunicipioFilter = useCallback(
    (item: any) => {
      if (!municipio || municipio === "Todos") return true;
      const target = normalizeKey(municipio);
      const value = normalizeKey(
        item?.municipio ??
          item?.municipio_exibicao ??
          item?.municipioExibicao ??
          item?.municipio_nome ??
          item?.municipioNome,
      );
      return value === target;
    },
    [municipio],
  );

  const matchesQuery = useCallback(
    (values: any[], fieldMap: Record<string, any[]> = {}) => {
      const trimmed = query.trim();
      if (!trimmed) return true;
      const tokens = trimmed.split(/\s+/).filter(Boolean);
      const fieldTokens = tokens.filter((token) => token.includes(":"));
      const freeTokens = tokens.filter((token) => !token.includes(":"));

      const matchesToken = (haystack: any[], token: string) => {
        if (!token) return true;
        const normalizedToken = normalizeKey(token);
        return haystack.some((value) => normalizeKey(value).includes(normalizedToken));
      };

      for (const rawToken of fieldTokens) {
        const [field, ...rest] = rawToken.split(":");
        const term = rest.join(":");
        const valuesForField = fieldMap[field] || [];
        if (!matchesToken(valuesForField, term)) {
          return false;
        }
      }

      if (freeTokens.length === 0) {
        return true;
      }

      const scopedValues =
        searchField !== "all" && fieldMap[searchField]
          ? fieldMap[searchField]
          : values;

      return freeTokens.every((token) => matchesToken(scopedValues, token));
    },
    [query, searchField],
  );

  const filterEmpresas = useCallback(
    (collection: any[]) =>
      collection.filter((empresa) => {
        if (!matchesMunicipioFilter(empresa)) return false;
        const values = [
          empresa?.empresa,
          empresa?.razao_social,
          empresa?.razaoSocial,
          empresa?.nome_fantasia,
          empresa?.nomeFantasia,
          empresa?.cnpj,
          empresa?.municipio,
          empresa?.responsavelFiscal,
        ];
        return matchesQuery(values, {
          nome: [empresa?.empresa, empresa?.nome_fantasia, empresa?.razao_social],
          razao: [empresa?.razao_social, empresa?.empresa],
          cnpj: [empresa?.cnpj],
        });
      }),
    [matchesMunicipioFilter, matchesQuery],
  );

  const filteredEmpresas = useMemo(
    () => filterEmpresas(empresas),
    [empresas, filterEmpresas],
  );

  const processosNormalizados = useMemo(
    () => processos.map(normalizeProcesso),
    [processos],
  );

  const licencasByEmpresa = useMemo(() => {
    const map = new Map<number, any[]>();
    licencas.forEach((lic) => {
      const empresaId = extractEmpresaId(lic);
      if (empresaId === undefined) return;
      const items = map.get(empresaId) || [];
      items.push(lic);
      map.set(empresaId, items);
    });
    return map;
  }, [licencas, extractEmpresaId]);

  const taxasByEmpresa = useMemo(() => {
    const map = new Map<number, any>();
    taxas.forEach((taxa) => {
      const empresaId = extractEmpresaId(taxa);
      if (empresaId === undefined) return;
      map.set(empresaId, taxa);
    });
    return map;
  }, [taxas, extractEmpresaId]);

  const processosByEmpresa = useMemo(() => {
    const map = new Map<number, any[]>();
    processosNormalizados.forEach((proc) => {
      const empresaId = extractEmpresaId(proc);
      if (empresaId === undefined) return;
      const items = map.get(empresaId) || [];
      items.push(proc);
      map.set(empresaId, items);
    });
    return map;
  }, [processosNormalizados, extractEmpresaId]);

  const filteredLicencas = useMemo(
    () =>
      licencas.filter((lic) => {
        if (!matchesMunicipioFilter(lic)) return false;
        const values = [
          lic?.empresa,
          lic?.cnpj,
          lic?.tipo,
          lic?.status,
          lic?.validade,
          lic?.municipio,
        ];
        return matchesQuery(values, {
          nome: [lic?.empresa],
          razao: [lic?.empresa],
          cnpj: [lic?.cnpj],
        });
      }),
    [licencas, matchesMunicipioFilter, matchesQuery],
  );

  const companyHasAlert = useCallback(
    (empresa: any) => {
      const empresaId = extractEmpresaId(empresa);
      if (isAlertStatus(empresa?.debito)) return true;
      if (empresa?.certificado && getStatusKey(empresa.certificado).includes("venc")) return true;
      if (empresaId === undefined) return false;

      const licList = licencasByEmpresa.get(empresaId) || [];
      if (licList.some((lic) => isAlertStatus(lic?.status))) return true;

      const taxa = taxasByEmpresa.get(empresaId);
      if (taxa) {
        const statusValues = Object.values(taxa).filter((value) => typeof value === "string");
        if (statusValues.some((value) => isAlertStatus(value))) return true;
      }

      const procList = processosByEmpresa.get(empresaId) || [];
      if (procList.some((proc) => isProcessStatusActiveOrPending(proc?.status))) return true;

      return false;
    },
    [extractEmpresaId, licencasByEmpresa, processosByEmpresa, taxasByEmpresa],
  );

  const backgroundClass = TAB_BACKGROUNDS[tab as keyof typeof TAB_BACKGROUNDS] || "bg-slate-50";

  return (
    <div className={`min-h-screen ${backgroundClass}`}>
      <HeaderMenuPro
        tab={tab}
        onTabChange={setTab}
        navItems={NAV_ITEMS}
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
      />

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <div className="flex items-center justify-between pb-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Portal eControle • S6
          </div>
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
            onClick={() => void logout()}
          >
            Sair
          </button>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Carregando dados...
          </div>
        )}

        {!loading && tab === "painel" && (
          <PainelScreen
            query={query}
            municipio={municipio}
            soAlertas={somenteAlertas}
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
          />
        )}

        {!loading && tab === "empresas" && (
          <EmpresasScreen
            filteredEmpresas={filteredEmpresas}
            empresas={empresas}
            soAlertas={somenteAlertas}
            extractEmpresaId={extractEmpresaId}
            licencasByEmpresa={licencasByEmpresa}
            taxasByEmpresa={taxasByEmpresa}
            processosByEmpresa={processosByEmpresa}
            handleCopy={handleCopy}
            enqueueToast={enqueueToast}
          />
        )}

        {!loading && tab === "licencas" && (
          <>
            {notFound.licencas &&
              renderEmptyState(
                "Em breve",
                "Licenças ainda não foram publicadas no backend desta stage.",
              )}
            {!notFound.licencas && (
              <LicencasScreen
                licencas={licencas}
                filteredLicencas={filteredLicencas}
                modoFoco={modoFoco}
                handleCopy={handleCopy}
              />
            )}
            {errors.licencas &&
              renderEmptyState("Erro ao carregar licenças", errors.licencas)}
          </>
        )}

        {!loading && tab === "taxas" && (
          <>
            {notFound.taxas &&
              renderEmptyState(
                "Em breve",
                "Taxas ainda não foram publicadas no backend desta stage.",
              )}
            {!notFound.taxas && (
              <TaxasScreen
                taxas={taxas}
                modoFoco={modoFoco}
                matchesMunicipioFilter={matchesMunicipioFilter}
                matchesQuery={matchesQuery}
                handleCopy={handleCopy}
              />
            )}
            {errors.taxas && renderEmptyState("Erro ao carregar taxas", errors.taxas)}
          </>
        )}

        {!loading && tab === "processos" && (
          <>
            {notFound.processos &&
              renderEmptyState(
                "Em breve",
                "Processos ainda não foram publicados no backend desta stage.",
              )}
            {!notFound.processos && (
              <ProcessosScreen
                processosNormalizados={processosNormalizados}
                modoFoco={modoFoco}
                soAlertas={somenteAlertas}
                matchesMunicipioFilter={matchesMunicipioFilter}
                matchesQuery={matchesQuery}
                handleCopy={handleCopy}
              />
            )}
            {errors.processos &&
              renderEmptyState("Erro ao carregar processos", errors.processos)}
          </>
        )}
      </main>

      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-lg"
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
