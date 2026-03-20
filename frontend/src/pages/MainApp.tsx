import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, Database, Filter } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import PageTitle from "@/components/layout/PageTitle";
import PainelScreen from "./PainelScreen";
import EmpresasScreen from "./EmpresasScreen";
import LicencasScreen from "./LicencasScreen";
import TaxasScreen from "./TaxasScreen";
import ProcessosScreen from "./ProcessosScreen";
import CertificadosScreen from "./CertificadosScreen";
import { useAuth } from "../hooks/useAuth";
import { fetchJson } from "../lib/api";
import { TAB_BACKGROUNDS } from "../lib/constants";
import { APP_NAV_ITEMS, TAB_TITLES, type AppTabKey } from "@/lib/theme";
import { normalizeText, removeDiacritics } from "../lib/text";
import { getStatusKey, isAlertStatus, isProcessStatusActiveOrPending } from "../lib/status";
import { listarEmpresas } from "../services/empresas";
import { listarGruposKPIs } from "../services/kpis";
import { formatMunicipioDisplay } from "@/lib/normalization";

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

const normalizeCnpjDigits = (value: any) => String(value ?? "").replace(/\D/g, "");
const normalizeTipoProcessoKey = (value: any) =>
  removeDiacritics(normalizeText(value))
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

const hasValue = (value: any) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const getEmpresaKey = (item: any) => {
  const candidate =
    item?.empresa_id ??
    item?.empresaId ??
    item?.company_id ??
    item?.companyId ??
    item?.id;
  if (candidate === undefined || candidate === null) return undefined;
  const key = String(candidate).trim();
  return key || undefined;
};

const normalizeEmpresaRecord = (empresa: any) => {
  const empresaId = getEmpresaKey(empresa);
  const empresaNome =
    empresa?.empresa ??
    empresa?.razao_social ??
    empresa?.razaoSocial ??
    empresa?.nome_fantasia ??
    empresa?.nomeFantasia ??
    "—";

  return {
    ...empresa,
    ...(empresaId ? { empresa_id: empresaId } : {}),
    empresa: empresaNome,
    razao_social: empresa?.razao_social ?? empresa?.empresa ?? empresa?.razaoSocial ?? empresaNome,
    nome_fantasia: empresa?.nome_fantasia ?? empresa?.nomeFantasia ?? undefined,
    ie: empresa?.ie ?? empresa?.inscricao_estadual ?? empresa?.inscricaoEstadual,
    im:
      empresa?.im ??
      empresa?.inscricao_municipal ??
      empresa?.inscricaoMunicipal,
    inscricaoMunicipal:
      empresa?.inscricaoMunicipal ?? empresa?.inscricao_municipal ?? empresa?.im,
    inscricaoEstadual:
      empresa?.inscricaoEstadual ?? empresa?.inscricao_estadual ?? empresa?.ie,
    situacao: empresa?.situacao ?? empresa?.status_empresa,
    debito: empresa?.debito ?? empresa?.situacao_debito,
    certificado: empresa?.certificado ?? empresa?.certificado_digital,
    responsavelFiscal: empresa?.responsavelFiscal ?? empresa?.responsavel_fiscal,
    responsavelLegal: empresa?.responsavelLegal ?? empresa?.proprietario_principal,
    cpfResponsavelLegal: empresa?.cpfResponsavelLegal ?? empresa?.cpf,
    observacoes: empresa?.observacoes ?? empresa?.observacao ?? null,
    municipio: formatMunicipioDisplay(empresa?.municipio),
  };
};

const buildCompanyIndex = (empresas: any[]) => {
  const byId = new Map<string, any>();
  const byCnpj = new Map<string, any>();

  empresas.forEach((empresa) => {
    const normalized = normalizeEmpresaRecord(empresa);
    const key = getEmpresaKey(normalized);
    if (key) {
      byId.set(key, normalized);
    }

    const cnpjDigits = normalizeCnpjDigits(normalized?.cnpj);
    if (cnpjDigits) {
      byCnpj.set(cnpjDigits, normalized);
    }
  });

  return { byId, byCnpj };
};

const getCompanyFromIndexes = (item: any, indexes: { byId: Map<string, any>; byCnpj: Map<string, any> }) => {
  const key = getEmpresaKey(item);
  if (key && indexes.byId.has(key)) {
    return indexes.byId.get(key);
  }
  const cnpjDigits = normalizeCnpjDigits(item?.cnpj ?? item?.cnpj_empresa ?? item?.cnpjEmpresa);
  if (cnpjDigits && indexes.byCnpj.has(cnpjDigits)) {
    return indexes.byCnpj.get(cnpjDigits);
  }
  return undefined;
};

const hasCompanyReference = (item: any) =>
  Boolean(
    item?.company_id ??
      item?.companyId ??
      item?.empresa_id ??
      item?.empresaId ??
      item?.cnpj ??
      item?.cnpj_empresa ??
      item?.cnpjEmpresa ??
      item?.company_cnpj,
  );

const hasActiveCompanyLink = (item: any, indexes: { byId: Map<string, any>; byCnpj: Map<string, any> }) => {
  const company = getCompanyFromIndexes(item, indexes);
  if (company) return true;
  const companyId =
    item?.company_id ??
    item?.companyId ??
    item?.empresa_id ??
    item?.empresaId;
  if (companyId !== undefined && companyId !== null) {
    return indexes.byId.has(String(companyId).trim());
  }
  const cnpjDigits = normalizeCnpjDigits(
    item?.cnpj ?? item?.cnpj_empresa ?? item?.cnpjEmpresa ?? item?.company_cnpj,
  );
  if (cnpjDigits) {
    return indexes.byCnpj.has(cnpjDigits);
  }
  return false;
};

const isUnregisteredDiversosProcess = (item: any) => {
  const processType = String(item?.process_type ?? item?.tipo ?? "").trim().toUpperCase();
  const explicitFlag =
    item?.empresa_nao_cadastrada === true ||
    item?.raw?.empresa_nao_cadastrada === true;
  if (explicitFlag) return true;
  if (processType !== "DIVERSOS") return false;
  const hasNoCompanyId = !String(item?.company_id ?? item?.companyId ?? "").trim();
  const hasManualCompanyData = Boolean(
    String(item?.company_cnpj ?? item?.raw?.company_cnpj ?? item?.cnpj ?? "").trim() &&
      String(item?.company_razao_social ?? item?.raw?.company_razao_social ?? item?.empresa ?? "").trim(),
  );
  return hasNoCompanyId && hasManualCompanyData;
};

const enrichWithCompany = (
  item: any,
  indexes: { byId: Map<string, any>; byCnpj: Map<string, any> },
) => {
  const company = getCompanyFromIndexes(item, indexes);
  const empresaId = getEmpresaKey(item) ?? getEmpresaKey(company);
  const fallbackEmpresa = item?.company_name ?? item?.company_razao_social ?? item?.empresa ?? item?.razao_social;
  const empresaNome =
    fallbackEmpresa ??
    company?.empresa ??
    company?.razao_social ??
    (empresaId ? `Empresa não vinculada (ID ${empresaId})` : "Empresa não vinculada");
  const hasBackendCompany = Boolean(item?.company_name || item?.company_razao_social || item?.company_cnpj);
  const semVinculo = Boolean(item?.sem_vinculo) || (!hasBackendCompany && !company);

  return {
    ...item,
    ...(empresaId ? { empresa_id: empresaId, company_id: item?.company_id ?? empresaId } : {}),
    empresa: empresaNome,
    cnpj: item?.cnpj ?? item?.cnpj_empresa ?? item?.cnpjEmpresa ?? company?.cnpj,
    municipio: formatMunicipioDisplay(item?.municipio ?? company?.municipio),
    sem_vinculo: semVinculo,
  };
};

const adaptTaxasRecords = (taxas: any[], indexes: { byId: Map<string, any>; byCnpj: Map<string, any> }) =>
  taxas.map((taxa) => {
    const enriched = enrichWithCompany(taxa, indexes);
    return {
      ...enriched,
      func: taxa?.func ?? taxa?.taxa_funcionamento,
      publicidade: taxa?.publicidade ?? taxa?.taxa_publicidade,
      sanitaria: taxa?.sanitaria ?? taxa?.taxa_vig_sanitaria,
      localizacao_instalacao:
        taxa?.localizacao_instalacao ?? taxa?.taxa_localiz_instalacao,
      area_publica: taxa?.area_publica ?? taxa?.taxa_ocup_area_publica,
      bombeiros: taxa?.bombeiros ?? taxa?.taxa_bombeiros,
      status_geral: taxa?.status_geral ?? taxa?.status_taxas,
    };
  });

const LICENSE_FIELD_MAP = [
  { field: "alvara_vig_sanitaria", tipo: "Sanitária" },
  { field: "cercon", tipo: "CERCON" },
  { field: "alvara_funcionamento", tipo: "Funcionamento" },
  { field: "certidao_uso_solo", tipo: "Uso do Solo" },
  { field: "licenca_ambiental", tipo: "Ambiental" },
];

const adaptLicencasRecords = (
  licencas: any[],
  indexes: { byId: Map<string, any>; byCnpj: Map<string, any> },
) => {
  const expanded: any[] = [];

  licencas.forEach((lic) => {
    const enriched = enrichWithCompany(lic, indexes);

    // Formato legado (1 linha por licença) -> apenas enriquece aliases
    if (hasValue(lic?.tipo) || hasValue(lic?.status) || hasValue(lic?.validade)) {
      expanded.push({
        ...enriched,
        licence_id: lic?.licence_id ?? lic?.id,
        licence_field:
          lic?.licence_field ??
          LICENSE_FIELD_MAP.find((entry) => entry.tipo.toLowerCase() === String(lic?.tipo || "").toLowerCase())?.field,
        status_geral: lic?.status_geral ?? lic?.statusGeral,
        motivo_nao_exigido: lic?.motivo_nao_exigido ?? lic?.raw?.motivo_nao_exigido,
        justificativa_nao_exigido:
          lic?.justificativa_nao_exigido ?? lic?.raw?.justificativa_nao_exigido,
        valid_until: lic?.valid_until ?? lic?.validade ?? null,
        company_name: lic?.company_name,
      });
      return;
    }

    // Formato novo (1 linha agregada por empresa) -> expande para formato legado
    LICENSE_FIELD_MAP.forEach(({ field, tipo }) => {
      const status = lic?.[field];
      const normalizedStatus = hasValue(status) ? status : "nao_possui";
      const sourceRaw = lic?.raw && typeof lic.raw === "object" ? lic.raw : {};
      const validUntilRaw =
        lic?.[`${field}_valid_until`] ??
        sourceRaw?.[`${field}_valid_until`] ??
        null;
      const validadeRaw =
        lic?.[`validade_${field}`] ??
        sourceRaw?.[`validade_${field}`] ??
        sourceRaw?.[`${field}_validade`] ??
        null;

      expanded.push({
        ...enriched,
        id: `${lic?.id ?? enriched?.empresa_id ?? "lic"}:${field}`,
        licence_id: lic?.id,
        licence_field: field,
        tipo,
        status: normalizedStatus,
        status_geral: lic?.status_geral ?? lic?.statusGeral ?? null,
        valid_until: validUntilRaw,
        validade: validadeRaw,
        validade_br:
          lic?.[`validade_${field}_br`] ??
          sourceRaw?.[`validade_${field}_br`] ??
          (typeof validadeRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(validadeRaw)
            ? `${validadeRaw.slice(8, 10)}/${validadeRaw.slice(5, 7)}/${validadeRaw.slice(0, 4)}`
            : null) ??
          null,
        status_detalhe: sourceRaw?.[`${field}_detalhe`] ?? null,
        motivo_nao_exigido:
          sourceRaw?.[`${field}_motivo_nao_exigido`] ?? lic?.motivo_nao_exigido ?? null,
        justificativa_nao_exigido:
          sourceRaw?.[`${field}_justificativa_nao_exigido`] ?? lic?.justificativa_nao_exigido ?? null,
        observacao: sourceRaw?.[`${field}_observacao`] ?? null,
        responsavel: sourceRaw?.[`${field}_responsavel`] ?? null,
        proxima_acao: sourceRaw?.[`${field}_proxima_acao`] ?? null,
        company_name: lic?.company_name,
        company_razao_social: lic?.company_razao_social,
        company_cnpj: lic?.company_cnpj,
      });
    });
  });

  return expanded;
};

const adaptProcessosRecords = (
  processos: any[],
  indexes: { byId: Map<string, any>; byCnpj: Map<string, any> },
  taxasByCompanyId: Map<string, any>,
  taxasByCnpj: Map<string, any>,
) =>
  processos.map((proc) => {
    const raw = proc?.raw && typeof proc.raw === "object" ? proc.raw : {};
    const extra = proc?.extra && typeof proc.extra === "object" ? proc.extra : {};
    const merged = { ...raw, ...proc, ...extra };
    const enriched = enrichWithCompany(merged, indexes);
    const companyIdKey = String(
      enriched?.company_id ?? enriched?.empresa_id ?? proc?.company_id ?? proc?.empresa_id ?? "",
    ).trim();
    const cnpjDigits = normalizeCnpjDigits(
      enriched?.cnpj ?? enriched?.cnpj_empresa ?? proc?.cnpj ?? proc?.cnpj_empresa,
    );
    const taxa =
      (companyIdKey && taxasByCompanyId.get(companyIdKey)) ||
      (cnpjDigits && taxasByCnpj.get(cnpjDigits)) ||
      null;
    const tipoKey = normalizeTipoProcessoKey(
      proc?.process_type ?? proc?.tipo ?? raw?.process_type ?? raw?.tipo,
    );
    const isCercon = tipoKey.includes("CERCON") || tipoKey.includes("BOMBEIROS");
    const isSanitario =
      tipoKey.includes("ALVARA_SANITARIO") || tipoKey.includes("SANITARIO");
    const tpiSyncStatus = isCercon ? taxa?.tpi ?? taxa?.taxa_tpi ?? null : null;
    const taxaBombeirosSyncStatus = isCercon
      ? taxa?.taxa_bombeiros ?? taxa?.bombeiros ?? null
      : null;
    const taxaSanitariaSyncStatus = isSanitario
      ? taxa?.sanitaria ?? taxa?.taxa_vig_sanitaria ?? null
      : null;

    return {
      ...raw,
      ...proc,
      ...extra,
      ...enriched,
      id:
        proc?.id ??
        proc?.process_id ??
        proc?.processId ??
        raw?.id ??
        raw?.process_id,
      tipo:
        proc?.tipo ??
        proc?.tipo_processo ??
        proc?.tipoProcesso ??
        proc?.process_type ??
        raw?.tipo ??
        raw?.process_type,
      status:
        proc?.status ??
        proc?.situacao ??
        proc?.status_padrao ??
        raw?.status ??
        raw?.situacao,
      situacao: proc?.situacao ?? raw?.situacao ?? raw?.status,
      tpi_sync_status: tpiSyncStatus,
      taxa_bombeiros_sync_status: taxaBombeirosSyncStatus,
      taxa_sanitaria_sync_status: taxaSanitariaSyncStatus,
    };
  });

const normalizeProcesso = (proc: any) => ({
  ...proc,
  id: proc?.id ?? proc?.process_id ?? proc?.processId ?? proc?.processo_id,
  empresa:
    proc?.empresa ??
    proc?.razao_social ??
    proc?.razaoSocial ??
    proc?.nome_fantasia ??
    proc?.nomeFantasia ??
    proc?.razao ??
    proc?.nome ??
    "—",
  empresa_id: proc?.empresa_id ?? proc?.empresaId ?? proc?.company_id ?? proc?.companyId,
  company_id: proc?.company_id ?? proc?.companyId ?? proc?.empresa_id ?? proc?.empresaId,
  cnpj: proc?.cnpj ?? proc?.cnpj_empresa ?? proc?.cnpjEmpresa,
  municipio: formatMunicipioDisplay(
    proc?.municipio ??
      proc?.municipio_exibicao ??
      proc?.municipioExibicao ??
      proc?.municipio_nome ??
      proc?.municipioNome,
  ),
  situacao: proc?.situacao ?? proc?.status ?? proc?.status_padrao,
  status: proc?.status ?? proc?.situacao ?? proc?.status_padrao,
  tipo: proc?.tipo ?? proc?.tipo_processo ?? proc?.tipoProcesso ?? proc?.process_type,
});

const renderEmptyState = (title: string, message: string) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-600">
    <div className="text-base font-semibold text-slate-800">{title}</div>
    <p className="mt-1 text-sm text-slate-500">{message}</p>
  </div>
);

export default function MainApp() {
  const { logout } = useAuth();
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
  const [panelNavigation, setPanelNavigation] = useState<{
    id: number;
    tab: AppTabKey;
    preset?: Record<string, any> | null;
  } | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

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

  const loadAllData = useCallback(async () => {
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
        municipiosResponse,
        meResponse,
      ] = await Promise.allSettled([
        listarEmpresas({ limit: 1000 }),
        fetchJson("/api/v1/licencas", { query: { limit: 1000 } }),
        fetchJson("/api/v1/taxas", { query: { limit: 1000 } }),
        fetchJson("/api/v1/processos", { query: { limit: 1000 } }),
        fetchJson("/api/v1/certificados", { query: { limit: 1000 } }),
        listarGruposKPIs({}),
        fetchJson("/api/v1/companies/municipios"),
        fetchJson("/api/v1/auth/me"),
      ]);

      const nextErrors: Record<string, string> = {};
      const readCollection = (result: PromiseSettledResult<any>, key?: string) => {
        if (result.status === "fulfilled") {
          return normalizeItems(result.value);
        }
        const message = result.reason?.message || "Falha ao carregar dados.";
        if (key) {
          nextErrors[key] = message;
        }
        return [];
      };

      const empresasRaw = readCollection(empresasResponse, "empresas");
      const empresasNormalized = empresasRaw.map(normalizeEmpresaRecord);
      const companyIndexes = buildCompanyIndex(empresasNormalized);

      const licencasRaw = readCollection(licencasResponse, "licencas");
      const taxasRaw = readCollection(taxasResponse, "taxas");
      const processosRaw = readCollection(processosResponse, "processos");
      const certificadosRaw = readCollection(certificadosResponse, "certificados");
      const licencasLinked = licencasRaw.filter((item: any) => hasActiveCompanyLink(item, companyIndexes));
      const taxasLinked = taxasRaw.filter((item: any) => hasActiveCompanyLink(item, companyIndexes));
      const processosLinked = processosRaw.filter(
        (item: any) =>
          hasActiveCompanyLink(item, companyIndexes) ||
          isUnregisteredDiversosProcess(item),
      );
      const certificadosLinked = certificadosRaw.filter(
        (item: any) => !hasCompanyReference(item) || hasActiveCompanyLink(item, companyIndexes),
      );

      const taxasAdaptadas = adaptTaxasRecords(taxasLinked, companyIndexes);
      const taxasByCompanyId = new Map<string, any>();
      const taxasByCnpj = new Map<string, any>();
      taxasAdaptadas.forEach((taxa) => {
        const companyKey = String(
          taxa?.company_id ?? taxa?.empresa_id ?? taxa?.companyId ?? taxa?.empresaId ?? "",
        ).trim();
        if (companyKey) {
          taxasByCompanyId.set(companyKey, taxa);
        }
        const cnpjDigits = normalizeCnpjDigits(taxa?.cnpj ?? taxa?.cnpj_empresa ?? taxa?.cnpjEmpresa);
        if (cnpjDigits) {
          taxasByCnpj.set(cnpjDigits, taxa);
        }
      });

      setEmpresas(empresasNormalized);
      setLicencas(adaptLicencasRecords(licencasLinked, companyIndexes));
      setTaxas(taxasAdaptadas);
      setProcessos(adaptProcessosRecords(processosLinked, companyIndexes, taxasByCompanyId, taxasByCnpj));
      setCertificados(certificadosLinked);

      if (kpisResponse.status === "fulfilled") {
        setKpis(kpisResponse.value || {});
      } else {
        nextErrors.kpis = kpisResponse.reason?.message || "Falha ao carregar KPIs.";
        setKpis({});
      }
      if (municipiosResponse.status === "fulfilled") {
        const values = Array.isArray(municipiosResponse.value) ? municipiosResponse.value : [];
        setMunicipiosApi(values.filter(Boolean));
      } else {
        setMunicipiosApi([]);
      }
      if (meResponse.status === "fulfilled") {
        const roles = Array.isArray(meResponse.value?.roles) ? meResponse.value.roles : [];
        setCurrentRoles(roles.map((role: any) => String(role).toUpperCase()));
      } else {
        setCurrentRoles([]);
      }

      setErrors(nextErrors);
      return true;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!active) return;
      await loadAllData();
    })();
    return () => {
      active = false;
    };
  }, [loadAllData]);

  const loadAllDataWithScrollRestore = useCallback(async () => {
    const scrollTop = contentScrollRef.current?.scrollTop ?? 0;
    const ok = await loadAllData();
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
      setTab(payload.tab);
      setPanelNavigation({
        id: Date.now(),
        tab: payload.tab,
        preset: payload.preset ?? null,
      });
    },
    [],
  );

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

  const extractEmpresaId = useCallback((empresa: any) => {
    const idCandidate =
      empresa?.empresa_id ?? empresa?.empresaId ?? empresa?.company_id ?? empresa?.companyId ?? empresa?.id;
    if (idCandidate === undefined || idCandidate === null) return undefined;
    const normalized = String(idCandidate).trim();
    return normalized || undefined;
  }, []);

  const municipios = useMemo(() => {
    if (municipiosApi.length > 0) {
      const list = Array.from(
        new Set(municipiosApi.filter(Boolean).map((value) => formatMunicipioDisplay(value)).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b));
      return ["Todos", ...list];
    }
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
          const normalized = formatMunicipioDisplay(value);
          if (normalized) {
            entries.add(normalized);
          }
        }
      });
    });
    const list = Array.from(entries).filter(Boolean).sort((a, b) => a.localeCompare(b));
    return ["Todos", ...list];
  }, [empresas, licencas, municipiosApi, processos, taxas]);

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
          empresa?.observacoes,
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
    const map = new Map<string, any[]>();
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
    const map = new Map<string, any>();
    taxas.forEach((taxa) => {
      const empresaId = extractEmpresaId(taxa);
      if (empresaId === undefined) return;
      map.set(empresaId, taxa);
    });
    return map;
  }, [taxas, extractEmpresaId]);

  const processosByEmpresa = useMemo(() => {
    const map = new Map<string, any[]>();
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
      if (normalizeKey(empresa?.debito).includes("possui debito")) return true;
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
  const pageMeta = TAB_TITLES[tab];
  const activeNav = APP_NAV_ITEMS.find((item) => item.key === tab);
  const pageChips = [
    { label: activeNav?.label || "Tela", variant: "info" as const },
    ...(somenteAlertas ? [{ label: "Somente alertas", variant: "warn" as const }] : []),
    ...(modoFoco ? [{ label: "Modo foco", variant: "ok" as const }] : []),
  ];

  return (
    <div className="h-screen overflow-hidden bg-app">
      <div className="flex h-screen">
        <Sidebar
          items={APP_NAV_ITEMS}
          activeTab={tab}
          onTabChange={setTab}
          onLogout={() => void logout()}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            items={APP_NAV_ITEMS}
            activeTab={tab}
            onTabChange={setTab}
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
            onReload={() => {
              void loadAllDataWithScrollRestore();
            }}
            onLogout={() => void logout()}
          />

          <div ref={contentScrollRef} className={`min-w-0 flex-1 min-h-0 overflow-y-auto bg-app ${backgroundClass}`}>
            <main className="mx-auto max-w-[1500px] px-4 py-4 lg:px-6 lg:py-5">
              <PageTitle
                title={pageMeta.title}
                subtitle={pageMeta.subtitle}
                chips={pageChips}
                right={
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl border border-subtle bg-card px-3 py-2 text-right shadow-sm">
                      <div className="flex items-center justify-end gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <Database className="h-3.5 w-3.5" /> Dados
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {empresas.length}/{licencas.length}/{taxas.length}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-subtle bg-card px-3 py-2 text-right shadow-sm">
                      <div className="flex items-center justify-end gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <Filter className="h-3.5 w-3.5" /> Filtros
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {municipio === "Todos" ? "Todos" : municipio}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-subtle bg-card px-3 py-2 text-right shadow-sm">
                      <div className="flex items-center justify-end gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <BellRing className="h-3.5 w-3.5" /> Alertas
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {somenteAlertas ? "Filtrados" : "Todos"}
                      </div>
                    </div>
                  </div>
                }
              />

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
                      />
                      {errors.licencas && renderEmptyState("Erro ao carregar licenças", errors.licencas)}
                    </>
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
                        modoFoco={modoFoco}
                        soAlertas={somenteAlertas}
                        matchesMunicipioFilter={matchesMunicipioFilter}
                        matchesQuery={matchesQuery}
                        handleCopy={handleCopy}
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
                        modoFoco={modoFoco}
                        soAlertas={somenteAlertas}
                        matchesMunicipioFilter={matchesMunicipioFilter}
                        matchesQuery={matchesQuery}
                        handleCopy={handleCopy}
                        panelPreset={panelNavigation?.tab === "processos" ? panelNavigation : null}
                      />
                      {errors.processos && renderEmptyState("Erro ao carregar processos", errors.processos)}
                    </>
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
    </div>
  );
}
