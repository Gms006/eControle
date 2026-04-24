import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Chip } from "@/components/Chip";
import StatusBadge from "@/components/StatusBadge";
import { AlertTriangle, Bell, Building2, ChevronDown, ChevronUp, FileText, Filter, KanbanSquare, LayoutList, Plus, Save, Star, Trash2, Zap } from "lucide-react";
import { formatCanonicalLabel, parsePtDate, removeDiacritics } from "@/lib/text";
import { formatLicenceTypeLabel, formatProcessTypeLabel, formatTechnicalStatusLabel, getStatusKey, hasRelevantStatus, isAlertStatus, isProcessStatusInactive } from "@/lib/status";
import { getProcessUrgency } from "@/lib/processUrgency";
import { atualizarDashboardView, criarDashboardView, excluirDashboardView, listarDashboardViews } from "@/services/dashboardViews";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HEATMAP_MONTHS = 6;
const DEFAULT_RISK_KEYS = ["high", "medium", "low", "unmapped"];
const DEFAULT_FILTERS = {
  companyStatus: "Ativas",
  riskKeys: [...DEFAULT_RISK_KEYS],
  certBuckets: ["valido", "vencendo", "vencido", "sem_certificado"],
  municipio: [],
  urgencyMin: 0,
  urgencyMax: 100,
  somenteAlertas: false,
  modoFoco: false,
  profile: "geral",
};

const parseDateToLocalDay = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  if (typeof value === "string") {
    const ptDate = parsePtDate(value);
    if (ptDate instanceof Date && !Number.isNaN(ptDate.getTime())) return ptDate;
    const isoMatch = value.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }
  return null;
};

const toDayDiff = (value, start) => {
  const target = parseDateToLocalDay(value);
  if (!(target instanceof Date) || Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - start.getTime()) / MS_PER_DAY);
};

const normalizeKey = (value) => removeDiacritics(String(value ?? "").toLowerCase()).replace(/\s+/g, "_").trim();
const resolveCompanyId = (item) => String(item?.empresa_id ?? item?.empresaId ?? item?.company_id ?? item?.companyId ?? item?.id ?? "").trim() || undefined;
const resolveCnpjKey = (value) => String(value ?? "").replace(/\D/g, "").trim() || undefined;

const getCompanyRiskKey = (empresa) => {
  const key = normalizeKey(empresa?.risco_consolidado ?? empresa?.riscoConsolidado ?? empresa?.score_status ?? empresa?.scoreStatus);
  if (key.includes("high") || key.includes("alto")) return "high";
  if (key.includes("medium") || key.includes("medio")) return "medium";
  if (key.includes("low") || key.includes("baixo")) return "low";
  return "unmapped";
};

const parseCompanyIsActive = (value) => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const normalized = normalizeKey(value);
    if (["true", "1", "ativo", "ativa"].includes(normalized)) return true;
    if (["false", "0", "inativo", "inativa"].includes(normalized)) return false;
  }
  return null;
};

const getCompanyStatusKey = (empresa) => {
  const isActive = parseCompanyIsActive(empresa?.is_active);
  if (isActive === true) return "Ativas";
  if (isActive === false) return "Inativas";
  return null;
};

const normalizeCompanyStatusFilter = (value) => {
  const key = normalizeKey(value);
  if (key === "ativas" || key === "ativa") return "Ativas";
  if (key === "inativas" || key === "inativa") return "Inativas";
  if (key === "todas" || key === "todos") return "Todas";
  return "Ativas";
};

const normalizeMunicipioFilter = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value || value === "todos" || value === "Todos") return [];
  return [String(value)];
};

const getCompanyUrgencyScore = (empresa, companyHasAlert) => {
  const explicit = Number(empresa?.score_urgencia ?? empresa?.scoreUrgencia ?? empresa?.profile?.score_urgencia ?? empresa?.profile?.scoreUrgencia);
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(100, explicit));
  const riskBase = getCompanyRiskKey(empresa) === "high" ? 74 : getCompanyRiskKey(empresa) === "medium" ? 58 : getCompanyRiskKey(empresa) === "low" ? 36 : 48;
  return Math.max(0, Math.min(100, riskBase + (companyHasAlert(empresa) ? 18 : 0)));
};

const certBucketFromLabel = (statusLabel) => {
  const key = normalizeKey(statusLabel);
  if (!key || key === "nao_possui") return "sem_certificado";
  if (key.includes("vencid")) return "vencido";
  if (key.includes("vence") || key.includes("alert")) return "vencendo";
  if (key.includes("valid") || key.includes("ok")) return "valido";
  return "sem_certificado";
};

const RISK_OPTIONS = [
  { key: "high", label: "Alto" },
  { key: "medium", label: "Médio" },
  { key: "low", label: "Baixo" },
  { key: "unmapped", label: "Sem mapeamento" },
];

const CERT_OPTIONS = [
  { key: "valido", label: "Válido" },
  { key: "vencendo", label: "Vencendo" },
  { key: "vencido", label: "Vencido" },
  { key: "sem_certificado", label: "Sem certificado" },
];

const TAX_MATRIX_COLUMNS = [
  { key: "func", label: "FUNC" },
  { key: "publicidade", label: "PUB" },
  { key: "sanitaria", label: "SAN" },
  { key: "localizacao_instalacao", label: "LOC" },
  { key: "area_publica", label: "AREA" },
  { key: "bombeiros", label: "BOMB" },
  { key: "tpi", label: "TPI" },
];

const matrixCellClass = (tone) => tone === "red" ? "bg-rose-100 text-rose-700" : tone === "yellow" ? "bg-amber-100 text-amber-700" : tone === "green" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400";
const heatCellClass = (count) => count >= 8 ? "bg-rose-100 text-rose-700" : count >= 5 ? "bg-amber-100 text-amber-700" : count >= 2 ? "bg-blue-100 text-blue-700" : count >= 1 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400";

const toneFromStatus = (status) => {
  const key = normalizeKey(getStatusKey(status));
  if (!key) return { tone: "gray", short: "-" };
  if (key.includes("vencid") || key.includes("nao_pago") || key.includes("aberto") || key.includes("penden")) return { tone: "red", short: "Crit" };
  if (key.includes("vence") || key.includes("anal") || key.includes("aguard")) return { tone: "yellow", short: "Atn" };
  if (key.includes("ok") || key.includes("regular") || key.includes("pago") || key.includes("valid")) return { tone: "green", short: "OK" };
  return { tone: "gray", short: "-" };
};

const emptyBlock = (message) => <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{message}</div>;
const buildSparkSegments = (rawItems) => {
  const items = rawItems.filter((entry) => entry.value > 0);
  const total = items.reduce((acc, entry) => acc + entry.value, 0);
  if (total <= 0) return [];
  return items.map((entry) => ({ ...entry, width: `${Math.max(8, Math.round((entry.value / total) * 100))}%` }));
};

function KpiCard({ title, value, subtitle, icon, segments, accent = "blue", subtitleTone = "amber" }) {
  const accentMap = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    orange: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    red: "border-rose-200 bg-rose-50 text-rose-700",
  };
  const subtitleToneMap = {
    green: "text-emerald-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    red: "text-rose-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          <p className={`mt-1 text-xs ${subtitleToneMap[subtitleTone] || "text-slate-600"}`}>{subtitle}</p>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${accentMap[accent] || accentMap.blue}`}>{icon}</span>
      </div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-300">
        <div className="flex h-full w-full gap-4 px-2">
          {segments.length === 0 ? <div className="h-full w-full bg-slate-300" /> : segments.map((segment) => <div key={segment.key} className={segment.className} style={{ width: `clamp(8px, ${segment.width}, 14%)` }} title={`${segment.label}: ${segment.value}`} />)}
        </div>
      </div>
    </div>
  );
}

export default function PainelScreen(props) {
  const { municipio, soAlertas, modoFoco, currentRoles, empresas, licencas, taxas, certificados, processosNormalizados, filterEmpresas, companyHasAlert, licencasByEmpresa, extractEmpresaId, onOpenQueueTarget } = props;
  const [todayKey, setTodayKey] = useState(() => new Date().toDateString());
  const [panelFilters, setPanelFilters] = useState(() => ({ ...DEFAULT_FILTERS, municipio: normalizeMunicipioFilter(municipio), somenteAlertas: Boolean(soAlertas), modoFoco: Boolean(modoFoco) }));
  const [viewsState, setViewsState] = useState({ loading: false, items: [] });
  const [showRailMobile, setShowRailMobile] = useState(false);
  const [focusTarget, setFocusTarget] = useState("");
  const canManageShared = useMemo(() => Array.isArray(currentRoles) && currentRoles.some((role) => role === "ADMIN" || role === "DEV"), [currentRoles]);

  useEffect(() => { const i = setInterval(() => setTodayKey(new Date().toDateString()), 60 * 60 * 1000); return () => clearInterval(i); }, []);
  useEffect(() => {
    const onPanelFocus = (event) => {
      const target = event?.detail?.target;
      if (!target) return;
      setFocusTarget(String(target));
      if (target === "saved_views") setShowRailMobile(true);
      const element = document.getElementById(`painel-${target}`);
      if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("econtrole:painel-focus", onPanelFocus);
    return () => window.removeEventListener("econtrole:painel-focus", onPanelFocus);
  }, []);
  const startOfDay = useMemo(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }, [todayKey]);

  const companyIndexes = useMemo(() => {
    const byId = new Map();
    const byCnpj = new Map();
    empresas.forEach((empresa) => { const id = resolveCompanyId(empresa); if (id) byId.set(id, empresa); const cnpj = resolveCnpjKey(empresa?.cnpj); if (cnpj) byCnpj.set(cnpj, empresa); });
    return { byId, byCnpj };
  }, [empresas]);

  const resolveCompany = (item) => {
    const id = resolveCompanyId(item);
    if (id && companyIndexes.byId.has(id)) return companyIndexes.byId.get(id);
    const cnpj = resolveCnpjKey(item?.cnpj ?? item?.company_cnpj);
    if (cnpj && companyIndexes.byCnpj.has(cnpj)) return companyIndexes.byCnpj.get(cnpj);
    return null;
  };
  const certificadosByCompany = useMemo(() => {
    const map = new Map();
    (Array.isArray(certificados) ? certificados : []).forEach((cert) => {
      const company = resolveCompany(cert);
      const id = resolveCompanyId(cert) || resolveCompanyId(company);
      if (!id) return;
      const list = map.get(id) || [];
      list.push({ ...cert, empresa: cert?.empresa ?? company?.empresa, municipio: cert?.municipio ?? company?.municipio });
      map.set(id, list);
    });
    return map;
  }, [certificados, companyIndexes]);

  const certCategoryByCompany = (company) => {
    const companyId = resolveCompanyId(company);
    const certList = (companyId && certificadosByCompany.get(companyId)) || [];
    if (certList.length === 0) return certBucketFromLabel(company?.certificado);
    let best = "valido";
    certList.forEach((cert) => {
      const days = Number.isFinite(cert?.diasRestantes) ? Number(cert.diasRestantes) : toDayDiff(cert?.validoAte ?? cert?.valido_ate, startOfDay);
      if (typeof days === "number") {
        if (days < 0) best = "vencido";
        else if (days <= 30 && best !== "vencido") best = "vencendo";
        return;
      }
      const bucket = certBucketFromLabel(cert?.situacao ?? cert?.status);
      if (bucket === "vencido") best = "vencido";
      else if (bucket === "vencendo" && best !== "vencido") best = "vencendo";
    });
    return best;
  };

  const baseCompanies = useMemo(() => filterEmpresas(empresas), [empresas, filterEmpresas]);
  const filteredCompanies = useMemo(() => baseCompanies.filter((empresa) => {
    if (panelFilters.companyStatus !== "Todas") {
      const statusKey = getCompanyStatusKey(empresa);
      if (!statusKey || statusKey !== panelFilters.companyStatus) return false;
    }
    if (!panelFilters.riskKeys.includes(getCompanyRiskKey(empresa))) return false;
    if (!panelFilters.certBuckets.includes(certCategoryByCompany(empresa))) return false;
    if (panelFilters.municipio.length > 0 && !panelFilters.municipio.includes(String(empresa?.municipio || "").trim())) return false;
    const score = getCompanyUrgencyScore(empresa, companyHasAlert);
    if (score < panelFilters.urgencyMin || score > panelFilters.urgencyMax) return false;
    if (panelFilters.somenteAlertas && !companyHasAlert(empresa)) return false;
    return true;
  }), [baseCompanies, panelFilters, certificadosByCompany, startOfDay, companyHasAlert]);

  const filteredCompanyIds = useMemo(() => new Set(filteredCompanies.map((empresa) => resolveCompanyId(empresa)).filter(Boolean)), [filteredCompanies]);
  const filteredCompanyCnpjs = useMemo(() => new Set(filteredCompanies.map((empresa) => resolveCnpjKey(empresa?.cnpj)).filter(Boolean)), [filteredCompanies]);
  const belongsToFilteredCompanies = (item) => {
    const id = resolveCompanyId(item);
    if (id && filteredCompanyIds.has(id)) return true;
    const cnpj = resolveCnpjKey(item?.cnpj ?? item?.cnpj_empresa ?? item?.company_cnpj);
    return Boolean(cnpj && filteredCompanyCnpjs.has(cnpj));
  };

  const scopedLicencas = useMemo(() => licencas.filter((item) => belongsToFilteredCompanies(item)), [licencas, filteredCompanyIds, filteredCompanyCnpjs]);
  const scopedTaxas = useMemo(() => taxas.filter((item) => belongsToFilteredCompanies(item)), [taxas, filteredCompanyIds, filteredCompanyCnpjs]);
  const scopedProcessos = useMemo(() => processosNormalizados.filter((item) => belongsToFilteredCompanies(item)), [processosNormalizados, filteredCompanyIds, filteredCompanyCnpjs]);
  const scopedCertificados = useMemo(() => (Array.isArray(certificados) ? certificados.filter((item) => belongsToFilteredCompanies(item)) : []), [certificados, filteredCompanyIds, filteredCompanyCnpjs]);

  const licencaResumo = useMemo(() => scopedLicencas.reduce((acc, lic) => {
    if (!hasRelevantStatus(lic?.status)) return acc;
    const statusKey = getStatusKey(lic.status);
    const days = toDayDiff(lic?.validade ?? lic?.validade_br, startOfDay);
    acc.total += 1;
    if (statusKey.includes("vencid") || (typeof days === "number" && days < 0)) acc.vencidas += 1;
    else if (typeof days === "number" && days <= 7) acc.ate7 += 1;
    else if (typeof days === "number" && days <= 30) acc.ate30 += 1;
    else acc.maior30 += 1;
    return acc;
  }, { total: 0, vencidas: 0, ate7: 0, ate30: 0, maior30: 0 }), [scopedLicencas, startOfDay]);

  const taxasResumo = useMemo(() => {
    const groups = { tpi: 0, funcionamento: 0, sanitaria: 0, bombeiros: 0, outros: 0 };
    scopedTaxas.forEach((taxa) => {
      const columns = [
        { key: "tpi", value: taxa?.tpi ?? taxa?.taxa_tpi },
        { key: "funcionamento", value: taxa?.func ?? taxa?.taxa_funcionamento },
        { key: "sanitaria", value: taxa?.sanitaria ?? taxa?.taxa_vig_sanitaria },
        { key: "bombeiros", value: taxa?.bombeiros ?? taxa?.taxa_bombeiros },
      ];
      let counted = false;
      columns.forEach((column) => { if (isAlertStatus(column.value)) { groups[column.key] += 1; counted = true; } });
      if (!counted && isAlertStatus(taxa?.status_geral ?? taxa?.status_taxas)) groups.outros += 1;
    });
    return groups;
  }, [scopedTaxas]);

  const processosUrgentes = useMemo(() => scopedProcessos.map((proc, index) => {
    if (isProcessStatusInactive(proc.status)) return null;
    const urgency = getProcessUrgency(proc);
    if (!urgency.buckets.length) return null;
    const company = resolveCompany(proc);
    return {
      key: String(proc?.id ?? proc?.process_id ?? `${proc?.protocolo}-${index}`),
      empresa: proc?.empresa ?? company?.empresa ?? "Empresa nao vinculada",
      status: proc?.situacao ?? proc?.status ?? "Sem status",
      buckets: urgency.buckets,
      score: urgency.score,
      tipo: proc?.tipo ?? proc?.process_type ?? "Processo",
    };
  }).filter(Boolean).sort((a, b) => b.score - a.score), [scopedProcessos]);

  const processosGroups = useMemo(() => ({
    incomplete: processosUrgentes.filter((item) => item.buckets.includes("incomplete")),
    awaiting_payment: processosUrgentes.filter((item) => item.buckets.includes("awaiting_payment")),
    in_analysis: processosUrgentes.filter((item) => item.buckets.includes("in_analysis")),
    due7: processosUrgentes.filter((item) => item.buckets.includes("due7")),
  }), [processosUrgentes]);

  const meses = useMemo(() => {
    const m = [];
    for (let i = HEATMAP_MONTHS - 1; i >= 0; i -= 1) {
      const date = new Date(startOfDay.getFullYear(), startOfDay.getMonth() - i, 1);
      m.push({ key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleDateString("pt-BR", { month: "short" }).replace(/\./g, "") });
    }
    return m;
  }, [startOfDay]);

  const heatmapRows = useMemo(() => {
    const makeBucket = () => { const map = new Map(); meses.forEach((month) => map.set(month.key, 0)); return map; };
    const rows = { cercon: makeBucket(), funcionamento: makeBucket(), sanitaria: makeBucket(), ambiental: makeBucket(), certificados: makeBucket(), processos: makeBucket() };
    const addByDate = (bucket, value) => {
      const date = parseDateToLocalDay(value);
      if (!date) return;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!bucket.has(key)) return;
      bucket.set(key, (bucket.get(key) || 0) + 1);
    };
    scopedLicencas.forEach((item) => {
      if (!hasRelevantStatus(item?.status)) return;
      const typeKey = normalizeKey(item?.tipo);
      if (typeKey.includes("cercon") || typeKey.includes("bombeiro")) addByDate(rows.cercon, item?.validade ?? item?.validade_br);
      else if (typeKey.includes("funcionamento")) addByDate(rows.funcionamento, item?.validade ?? item?.validade_br);
      else if (typeKey.includes("sanit")) addByDate(rows.sanitaria, item?.validade ?? item?.validade_br);
      else if (typeKey.includes("ambient")) addByDate(rows.ambiental, item?.validade ?? item?.validade_br);
    });
    scopedCertificados.forEach((item) => {
      const days = Number.isFinite(item?.diasRestantes) ? Number(item.diasRestantes) : toDayDiff(item?.validoAte ?? item?.valido_ate, startOfDay);
      if (typeof days === "number" && days <= 30) addByDate(rows.certificados, item?.validoAte ?? item?.valido_ate);
    });
    scopedProcessos.forEach((item) => {
      if (isProcessStatusInactive(item?.status)) return;
      addByDate(rows.processos, item?.solicitacao ?? item?.created_at ?? item?.createdAt ?? item?.data_solicitacao);
    });
    return [
      { key: "cercon", label: "Bombeiros / CERCON", values: rows.cercon },
      { key: "funcionamento", label: "Funcionamento", values: rows.funcionamento },
      { key: "sanitaria", label: "Sanitária", values: rows.sanitaria },
      { key: "ambiental", label: "Ambiental", values: rows.ambiental },
      { key: "certificados", label: "Certificados", values: rows.certificados },
      { key: "processos", label: "Processos", values: rows.processos },
    ];
  }, [scopedLicencas, scopedCertificados, scopedProcessos, meses, startOfDay]);
  const kpiCards = useMemo(() => {
    const empresasAtencao = filteredCompanies.filter((empresa) => companyHasAlert(empresa));
    const attentionSegments = buildSparkSegments([
      { key: "high", label: "Risco alto", value: empresasAtencao.filter((item) => getCompanyRiskKey(item) === "high").length, className: "bg-rose-500" },
      { key: "medium", label: "Risco medio", value: empresasAtencao.filter((item) => getCompanyRiskKey(item) === "medium").length, className: "bg-amber-500" },
      { key: "low", label: "Risco baixo", value: empresasAtencao.filter((item) => getCompanyRiskKey(item) === "low").length, className: "bg-emerald-500" },
      { key: "unmapped", label: "Sem mapeamento", value: empresasAtencao.filter((item) => getCompanyRiskKey(item) === "unmapped").length, className: "bg-slate-400" },
    ]);
    const licencaSegments = buildSparkSegments([
      { key: "vencidas", label: "Vencidas", value: licencaResumo.vencidas, className: "bg-rose-500" },
      { key: "ate7", label: "Ate 7d", value: licencaResumo.ate7, className: "bg-amber-500" },
      { key: "ate30", label: "8-30d", value: licencaResumo.ate30, className: "bg-blue-500" },
      { key: "maior30", label: ">30d", value: licencaResumo.maior30, className: "bg-emerald-500" },
    ]);
    const taxaSegments = buildSparkSegments([
      { key: "tpi", label: "TPI", value: taxasResumo.tpi, className: "bg-rose-500" },
      { key: "func", label: "Func.", value: taxasResumo.funcionamento, className: "bg-amber-500" },
      { key: "san", label: "San.", value: taxasResumo.sanitaria, className: "bg-blue-500" },
      { key: "bomb", label: "Bomb.", value: taxasResumo.bombeiros, className: "bg-indigo-500" },
      { key: "outros", label: "Outros", value: taxasResumo.outros, className: "bg-slate-500" },
    ]);
    const processoSegments = buildSparkSegments([
      { key: "incomplete", label: "Triagem", value: processosGroups.incomplete.length, className: "bg-rose-500" },
      { key: "awaiting", label: "Pagamento", value: processosGroups.awaiting_payment.length, className: "bg-amber-500" },
      { key: "analysis", label: "Analise", value: processosGroups.in_analysis.length, className: "bg-blue-500" },
      { key: "due7", label: "Prazo", value: processosGroups.due7.length, className: "bg-indigo-500" },
    ]);
    return [
      { key: "empresas", title: "Empresas sob aten\u00e7\u00e3o", value: empresasAtencao.length, subtitle: `+${Math.max(0, filteredCompanies.length - empresasAtencao.length)} esta semana`, icon: <Building2 className="h-5 w-5" />, segments: attentionSegments, accent: "green", subtitleTone: "amber" },
      { key: "licencas", title: "Licen\u00e7as vencendo", value: licencaResumo.vencidas + licencaResumo.ate7 + licencaResumo.ate30, subtitle: `${licencaResumo.ate7} em at\u00e9 7 dias`, icon: <FileText className="h-5 w-5" />, segments: licencaSegments, accent: "orange", subtitleTone: "amber" },
      { key: "taxas", title: "Taxas irregulares", value: taxasResumo.tpi + taxasResumo.funcionamento + taxasResumo.sanitaria + taxasResumo.bombeiros + taxasResumo.outros, subtitle: `${scopedTaxas.length} com envio pendente`, icon: <Bell className="h-5 w-5" />, segments: taxaSegments, accent: "blue", subtitleTone: "amber" },
      { key: "processos", title: "Processos cr\u00edticos", value: processosUrgentes.length, subtitle: `-${Math.max(0, processosUrgentes.length - processosGroups.due7.length)} vs. \u00faltimo ciclo`, icon: <Zap className="h-5 w-5" />, segments: processoSegments, accent: "red", subtitleTone: "green" },
    ];
  }, [filteredCompanies, companyHasAlert, licencaResumo, taxasResumo, scopedTaxas.length, processosUrgentes, processosGroups]);

  const urgencias = useMemo(() => {
    const fromProcesses = processosUrgentes.slice(0, 10).map((item) => ({
      key: `proc-${item.key}`,
      score: Number(item.score) || 0,
      empresa: item.empresa,
      tipo: formatProcessTypeLabel(item.tipo),
      status: formatTechnicalStatusLabel(item.status),
      action: () => onOpenQueueTarget?.({ tab: "processos", preset: { bucket: item.buckets?.[0] || "all" } }),
    }));
    const fromLicencas = scopedLicencas.slice(0, 12).map((item, index) => ({
      key: `lic-${item?.id ?? index}`,
      score: Math.max(70, 100 - Math.max(0, toDayDiff(item?.validade ?? item?.validade_br, startOfDay) ?? 30)),
      empresa: item?.empresa ?? item?.company_name ?? "Empresa nao vinculada",
      tipo: formatLicenceTypeLabel(item?.tipo),
      status: formatTechnicalStatusLabel(item?.status),
      action: () => onOpenQueueTarget?.({ tab: "licencas", preset: { group: "vencido" } }),
    }));
    return [...fromProcesses, ...fromLicencas].sort((a, b) => b.score - a.score).slice(0, 8);
  }, [processosUrgentes, scopedLicencas, onOpenQueueTarget, startOfDay]);

  const denseRows = useMemo(() => filteredCompanies.map((empresa) => {
    const score = getCompanyUrgencyScore(empresa, companyHasAlert);
    const risco = getCompanyRiskKey(empresa);
    const cert = certCategoryByCompany(empresa);
    const pendencias = [
      companyHasAlert(empresa) ? 1 : 0,
      (licencasByEmpresa.get(extractEmpresaId(empresa)) || []).filter((lic) => belongsToFilteredCompanies(lic) && isAlertStatus(lic.status)).length,
    ].reduce((acc, n) => acc + n, 0);
    return {
      key: resolveCompanyId(empresa) || empresa?.cnpj || empresa?.empresa,
      empresa: empresa?.empresa || "Empresa",
      score,
      risco,
      certificado: cert,
      pendencias,
    };
  }).sort((a, b) => b.score - a.score).slice(0, 10), [filteredCompanies, companyHasAlert, certCategoryByCompany, licencasByEmpresa, extractEmpresaId, belongsToFilteredCompanies]);

  const matrixRows = useMemo(() => denseRows.map((row) => {
    const company = filteredCompanies.find((item) => resolveCompanyId(item) === row.key || item?.empresa === row.empresa);
    const companyId = resolveCompanyId(company);
    const taxa = scopedTaxas.find((item) => resolveCompanyId(item) === companyId || resolveCnpjKey(item?.cnpj) === resolveCnpjKey(company?.cnpj));
    const cells = TAX_MATRIX_COLUMNS.map((column) => {
      const raw = taxa?.[column.key];
      const tone = toneFromStatus(raw);
      return {
        ...column,
        tone: tone.tone,
        short: tone.short,
        label: formatTechnicalStatusLabel(raw || "Sem status"),
      };
    });
    return {
      ...row,
      cells,
    };
  }), [denseRows, filteredCompanies, scopedTaxas]);

  const kanbanGroups = useMemo(() => ({
    triagem: processosGroups.incomplete.slice(0, 8),
    aguardando: processosGroups.awaiting_payment.slice(0, 8),
    analise: processosGroups.in_analysis.slice(0, 8),
    concluir: processosGroups.due7.slice(0, 8),
  }), [processosGroups]);

  const loadViews = async () => {
    setViewsState((prev) => ({ ...prev, loading: true }));
    try {
      const response = await listarDashboardViews({ tabKey: "painel", limit: 200, offset: 0 });
      setViewsState({ loading: false, items: Array.isArray(response?.items) ? response.items : [] });
    } catch {
      setViewsState({ loading: false, items: [] });
    }
  };
  useEffect(() => { void loadViews(); }, []);

  const panelPayload = useMemo(() => ({ filters: panelFilters, layout: { rail_open_mobile: showRailMobile } }), [panelFilters, showRailMobile]);
  const applySavedView = (entry) => {
    const payload = entry?.payload_json || {};
    if (payload?.filters && typeof payload.filters === "object") {
      setPanelFilters((prev) => ({
        ...prev,
        ...payload.filters,
        companyStatus: normalizeCompanyStatusFilter(payload.filters.companyStatus ?? prev.companyStatus),
        municipio: normalizeMunicipioFilter(payload.filters.municipio ?? prev.municipio),
      }));
    }
  };
  const handleSaveCurrentView = async () => {
    const name = window.prompt("Nome da visao:", "Nova visao");
    if (!name || !name.trim()) return;
    const scope = canManageShared ? (window.confirm("Salvar como compartilhada para a organizacao?") ? "shared" : "personal") : "personal";
    await criarDashboardView({ name: name.trim(), tab_key: "painel", scope, payload_json: panelPayload, is_pinned: false });
    await loadViews();
  };
  const handleRenameView = async (entry) => { const next = window.prompt("Novo nome da visao:", entry?.name || ""); if (!next || !next.trim()) return; await atualizarDashboardView(entry.id, { name: next.trim() }); await loadViews(); };
  const handleDeleteView = async (entry) => { if (!window.confirm(`Excluir a visao \"${entry?.name}\"?`)) return; await excluirDashboardView(entry.id); await loadViews(); };
  const handleTogglePin = async (entry) => { await atualizarDashboardView(entry.id, { is_pinned: !entry?.is_pinned }); await loadViews(); };

  const activeBadges = useMemo(() => {
    const badges = [];
    if (panelFilters.companyStatus !== "Ativas") badges.push({ key: "companyStatus", label: `Status: ${formatCanonicalLabel(panelFilters.companyStatus)}` });
    if (panelFilters.riskKeys.length !== DEFAULT_RISK_KEYS.length) badges.push({ key: "riskKeys", label: `Risco: ${panelFilters.riskKeys.map((entry) => RISK_OPTIONS.find((option) => option.key === entry)?.label || formatCanonicalLabel(entry)).join(", ")}` });
    if (panelFilters.certBuckets.length !== 4) badges.push({ key: "certBuckets", label: `Certificado: ${panelFilters.certBuckets.map((entry) => CERT_OPTIONS.find((option) => option.key === entry)?.label || formatCanonicalLabel(entry)).join(", ")}` });
    if (panelFilters.municipio.length > 0) badges.push({ key: "municipio", label: `Município: ${panelFilters.municipio.join(", ")}` });
    if (panelFilters.urgencyMin !== 0 || panelFilters.urgencyMax !== 100) badges.push({ key: "urgency", label: `Urgencia: ${panelFilters.urgencyMin}-${panelFilters.urgencyMax}` });
    if (panelFilters.somenteAlertas) badges.push({ key: "somenteAlertas", label: "Somente alertas" });
    if (panelFilters.modoFoco) badges.push({ key: "modoFoco", label: "Modo foco" });
    return badges;
  }, [panelFilters]);

  const clearBadge = (key) => setPanelFilters((prev) => {
    if (key === "companyStatus") return { ...prev, companyStatus: "Ativas" };
    if (key === "riskKeys") return { ...prev, riskKeys: [...DEFAULT_RISK_KEYS] };
    if (key === "certBuckets") return { ...prev, certBuckets: ["valido", "vencendo", "vencido", "sem_certificado"] };
    if (key === "municipio") return { ...prev, municipio: [] };
    if (key === "urgency") return { ...prev, urgencyMin: 0, urgencyMax: 100 };
    if (key === "somenteAlertas") return { ...prev, somenteAlertas: false };
    if (key === "modoFoco") return { ...prev, modoFoco: false };
    return prev;
  });
  const municipioOptions = useMemo(() => {
    const entries = new Set(["todos"]);
    baseCompanies.forEach((empresa) => { if (empresa?.municipio) entries.add(empresa.municipio); });
    return Array.from(entries);
  }, [baseCompanies]);

  const chipClass = (active) => `rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
    active
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-white"
  }`;

  const rail = (
    <aside className="space-y-3 rounded-2xl border border-slate-300 bg-white p-3.5 shadow-sm xl:sticky xl:top-0 xl:self-start xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Contexto</p>
            <h3 className="text-sm font-semibold text-slate-900">Filtros persistentes</h3>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-center">
            <div className="text-sm font-semibold leading-4 text-blue-700">{activeBadges.length}</div>
            <div className="mt-1 text-[11px] font-medium leading-3 text-blue-700">{activeBadges.length === 1 ? "ativo" : "ativos"}</div>
          </div>
        </div>

        <div className="space-y-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Filtros rápidos</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPanelFilters((prev) => ({ ...prev, somenteAlertas: !prev.somenteAlertas }))} className={chipClass(panelFilters.somenteAlertas)}>
              Somente alertas
            </button>
            <button type="button" onClick={() => setPanelFilters((prev) => ({ ...prev, modoFoco: !prev.modoFoco }))} className={chipClass(panelFilters.modoFoco)}>
              Modo foco
            </button>
          </div>
        </div>

        <div id="painel-critical_queues" className={`space-y-3 rounded-xl border p-3 ${focusTarget === "critical_queues" ? "border-blue-300 bg-blue-50/50" : "border-slate-300 bg-slate-200/50"}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Status da empresa</p>
          <div className="flex flex-wrap gap-2">
            {["Ativas", "Inativas", "Todas"].map((value) => (
              <button key={value} type="button" onClick={() => setPanelFilters((prev) => ({ ...prev, companyStatus: value }))} className={chipClass(panelFilters.companyStatus === value)}>
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Risco CNAE</p>
          <div className="flex flex-wrap gap-2">
            {RISK_OPTIONS.map((option) => {
              const active = panelFilters.riskKeys.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() =>
                    setPanelFilters((prev) => {
                      const next = active ? prev.riskKeys.filter((entry) => entry !== option.key) : [...prev.riskKeys, option.key];
                      return { ...prev, riskKeys: next.length ? next : [...DEFAULT_RISK_KEYS] };
                    })
                  }
                  className={chipClass(active)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Certificado</p>
          <div className="flex flex-wrap gap-2">
            {CERT_OPTIONS.map((option) => {
              const active = panelFilters.certBuckets.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() =>
                    setPanelFilters((prev) => {
                      const next = active ? prev.certBuckets.filter((entry) => entry !== option.key) : [...prev.certBuckets, option.key];
                      return { ...prev, certBuckets: next.length ? next : [...CERT_OPTIONS.map((entry) => entry.key)] };
                    })
                  }
                  className={chipClass(active)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Município</p>
          <select
            multiple
            value={panelFilters.municipio}
            onChange={(event) => {
              const values = Array.from(event.target.selectedOptions).map((opt) => opt.value);
              setPanelFilters((prev) => ({ ...prev, municipio: values }));
            }}
            className="min-h-[92px] w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
          >
            {municipioOptions.filter((item) => item !== "todos").map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <p className="text-[11px] text-slate-500">Segure Ctrl/Cmd para selecionar múltiplos.</p>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Score de urgência</p>
          <div className="relative h-6">
            <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-100" />
            <div
              className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-300"
              style={{
                left: `${panelFilters.urgencyMin}%`,
                width: `${Math.max(0, panelFilters.urgencyMax - panelFilters.urgencyMin)}%`,
              }}
            />
            <input type="range" min={0} max={100} value={panelFilters.urgencyMin} onChange={(e) => { const v = Number(e.target.value); setPanelFilters((prev) => ({ ...prev, urgencyMin: Math.min(v, prev.urgencyMax) })); }} className="ec-urgency-range" aria-label="Score de urgência mínimo" />
            <input type="range" min={0} max={100} value={panelFilters.urgencyMax} onChange={(e) => { const v = Number(e.target.value); setPanelFilters((prev) => ({ ...prev, urgencyMax: Math.max(v, prev.urgencyMin) })); }} className="ec-urgency-range" aria-label="Score de urgência máximo" />
          </div>
          <div className="flex justify-between text-[11px] font-semibold text-slate-500">
            <span>{panelFilters.urgencyMin}</span>
            <span>{panelFilters.urgencyMax}</span>
          </div>
        </div>

        <div id="painel-saved_views" className={`space-y-2 rounded-xl border p-3 ${focusTarget === "saved_views" ? "border-blue-300 bg-blue-50/50" : "border-slate-300 bg-slate-200/50"}`}>
          <div className="flex items-center justify-between"><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-600">Views salvas</p><Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleSaveCurrentView}><Plus className="mr-1 h-3.5 w-3.5" /> Salvar</Button></div>
          {viewsState.loading ? <p className="text-xs text-slate-500">Carregando views...</p> : null}
          {!viewsState.loading && viewsState.items.length === 0 ? <p className="text-xs text-slate-500">Nenhuma view salva.</p> : null}
          {viewsState.items.map((entry) => {
            const filtersCount = Object.keys(entry?.payload_json?.filters || {}).length;
            return (
              <div key={entry.id} className="rounded-lg border border-slate-300 bg-slate-50 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{entry.name}</p>
                    <p className="text-[11px] text-slate-500">{entry.scope === "shared" ? "Compartilhada" : "Pessoal"} · {filtersCount} filtros</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => void handleTogglePin(entry)} className={`rounded-md p-1 ${entry.is_pinned ? "text-amber-600" : "text-slate-400"}`}><Star className="h-3.5 w-3.5" /></button>
                    {(entry.scope === "personal" || canManageShared) ? <><button type="button" onClick={() => void handleRenameView(entry)} className="rounded-md p-1 text-slate-500"><Save className="h-3.5 w-3.5" /></button><button type="button" onClick={() => void handleDeleteView(entry)} className="rounded-md p-1 text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button></> : null}
                  </div>
                </div>
                <div className="mt-2 flex justify-end"><Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => applySavedView(entry)}>Aplicar visão</Button></div>
              </div>
            );
          })}
        </div>
    </aside>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between xl:hidden"><Button type="button" variant="outline" className="h-9" onClick={() => setShowRailMobile((prev) => !prev)}><Filter className="mr-2 h-4 w-4" />Rail do painel{showRailMobile ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}</Button></div>
      {showRailMobile ? rail : null}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden xl:block">{rail}</div>
        <section className="space-y-4">
          {activeBadges.length > 0 ? <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3">{activeBadges.map((badge) => <button key={badge.key} type="button" onClick={() => clearBadge(badge.key)} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-700">{badge.label}<span className="text-blue-400">x</span></button>)}</div> : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{kpiCards.map((card) => <KpiCard key={card.key} title={card.title} value={card.value} subtitle={card.subtitle} icon={card.icon} segments={card.segments} accent={card.accent} subtitleTone={card.subtitleTone} />)}</div>

          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card className="shadow-sm"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base font-semibold"><Bell className="h-4 w-4" /> Mapa de calor de vencimentos</CardTitle></CardHeader><CardContent className="p-0"><ScrollArea className="h-[320px] px-4 pb-4"><div className="overflow-x-auto"><div className="grid min-w-[640px] grid-cols-[160px_repeat(6,minmax(56px,1fr))] gap-1.5"><div />{meses.map((month) => <div key={month.key} className="rounded-md bg-slate-100 py-1.5 text-center text-[11px] font-semibold uppercase text-slate-500">{month.label}</div>)}{heatmapRows.map((row) => <React.Fragment key={row.key}><div className="flex items-center text-[11px] font-semibold text-slate-600">{row.label}</div>{meses.map((month) => { const value = row.values.get(month.key) || 0; return <div key={`${row.key}-${month.key}`} className={`flex h-8 items-center justify-center rounded-md text-[11px] font-semibold ${heatCellClass(value)}`}>{value > 0 ? value : "-"}</div>; })}</React.Fragment>)}</div></div></ScrollArea></CardContent></Card>
            <Card className="shadow-sm"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base font-semibold"><AlertTriangle className="h-4 w-4" /> Ações urgentes</CardTitle></CardHeader><CardContent className="p-0"><ScrollArea className="h-[320px]">{urgencias.length === 0 ? <div className="p-4">{emptyBlock("Nenhuma prioridade urgente no recorte atual.")}</div> : <Table><TableHeader><TableRow><TableHead>Score</TableHead><TableHead>Empresa</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{urgencias.map((item) => <TableRow key={item.key}><TableCell><span className="inline-flex min-w-[34px] justify-center rounded-md bg-slate-900 px-2 py-1 text-xs font-bold text-white">{Math.round(item.score)}</span></TableCell><TableCell className="font-medium text-slate-800">{item.empresa}</TableCell><TableCell className="text-slate-600">{item.tipo}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell><TableCell><Button size="sm" variant="outline" onClick={item.action}>Abrir</Button></TableCell></TableRow>)}</TableBody></Table>}</ScrollArea></CardContent></Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <LayoutList className="h-4 w-4" /> Matriz semafórica por empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[320px]">
                  <div className="overflow-x-auto">
                  <table className="min-w-[760px] w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Empresa</th>
                        {TAX_MATRIX_COLUMNS.map((column) => (
                          <th key={column.key} className="px-2 py-2 text-center font-semibold text-slate-600">{column.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixRows.length === 0 ? (
                        <tr><td colSpan={1 + TAX_MATRIX_COLUMNS.length} className="px-3 py-6 text-center text-slate-500">Sem dados para matriz no recorte atual.</td></tr>
                      ) : matrixRows.map((row) => (
                        <tr key={row.key} className="border-t border-slate-100">
                          <td className="px-3 py-2.5 font-medium text-slate-800">{row.empresa}</td>
                          {row.cells.map((cell) => (
                            <td key={`${row.key}-${cell.key}`} className="px-2 py-2 text-center">
                              <span className={`inline-flex min-w-[34px] items-center justify-center rounded-md px-2 py-1 font-semibold ${matrixCellClass(cell.tone)}`} title={cell.label}>
                                {cell.short}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Tabela densa</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Risco</TableHead>
                        <TableHead>Certificado</TableHead>
                        <TableHead>Pend.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {denseRows.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-slate-500">Sem empresas no recorte atual.</TableCell></TableRow>
                      ) : denseRows.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="font-medium text-slate-800">{row.empresa}</TableCell>
                          <TableCell><span className="inline-flex min-w-[32px] justify-center rounded-md bg-slate-900 px-2 py-1 text-[11px] font-bold text-white">{Math.round(row.score)}</span></TableCell>
                          <TableCell>{formatCanonicalLabel(row.risco)}</TableCell>
                          <TableCell>{formatCanonicalLabel(row.certificado)}</TableCell>
                          <TableCell>{row.pendencias}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <KanbanSquare className="h-4 w-4" /> Kanban operacional
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[320px] px-4 pb-4">
                <div className="grid gap-3 lg:grid-cols-4">
                {[
                  { key: "triagem", title: "Triagem", items: kanbanGroups.triagem },
                  { key: "aguardando", title: "Aguardando pagamento", items: kanbanGroups.aguardando },
                  { key: "analise", title: "Em analise", items: kanbanGroups.analise },
                  { key: "concluir", title: "Concluir", items: kanbanGroups.concluir },
                ].map((column) => (
                  <div key={column.key} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{column.title}</p>
                      <Chip variant="neutral">{column.items.length}</Chip>
                    </div>
                    <div className="space-y-2">
                      {column.items.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-2 text-[11px] text-slate-500">Sem itens</p> : null}
                      {column.items.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => onOpenQueueTarget?.({ tab: "processos", preset: { bucket: item.buckets?.[0] || "all" } })}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-blue-200"
                        >
                          <p className="truncate text-xs font-semibold text-slate-800">{item.empresa}</p>
                          <p className="truncate text-[11px] text-slate-500">{formatProcessTypeLabel(item.tipo)}</p>
                          <div className="mt-1 flex items-center justify-between">
                            <StatusBadge status={formatTechnicalStatusLabel(item.status)} />
                            <span className="text-[11px] font-semibold text-slate-600">{Math.round(item.score)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
                </ScrollArea>
              </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}


