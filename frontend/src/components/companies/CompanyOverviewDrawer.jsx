import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BadgeAlert,
  BadgeCheck,
  Bell,
  Briefcase,
  Building2,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Info,
  Landmark,
  Pencil,
  RefreshCw,
  Search,
  ShieldX,
  TriangleAlert,
  X,
} from "lucide-react";
import CopyableCompanyName from "@/components/CopyableCompanyName";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/Chip";
import StatusBadge from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toUiBrDate } from "@/lib/date";
import { formatCpfCnpj, formatPhoneBr, normalizeText } from "@/lib/text";
import { getStatusKey } from "@/lib/status";

const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const formatSentence = (value) => {
  const text = normalizeText(value).trim();
  if (!text) return "—";
  const lower = text.toLocaleLowerCase("pt-BR");
  return `${lower.charAt(0).toLocaleUpperCase("pt-BR")}${lower.slice(1)}`;
};

const formatRiskLabel = (value) => {
  const key = String(value || "").trim().toUpperCase();
  if (key === "HIGH") return "Alto";
  if (key === "MEDIUM") return "Médio";
  if (key === "LOW") return "Baixo";
  return "—";
};

const formatScoreStatusLabel = (status) => {
  const key = String(status || "").trim().toUpperCase();
  if (key === "OK") return "Ok";
  if (key === "NO_CNAE") return "Sem cnae";
  if (key === "UNMAPPED_CNAE") return "Cnae não mapeado";
  if (key === "NO_LICENCE") return "Sem licença datada";
  return formatSentence(status);
};

const riskChipVariant = (risk) => {
  const key = String(risk || "").trim().toUpperCase();
  if (key === "HIGH") return "danger";
  if (key === "MEDIUM") return "warning";
  if (key === "LOW") return "success";
  return "neutral";
};

const resolveCompanyStatus = (companyPayload, profile) => {
  const status = companyPayload?.status_empresa ?? companyPayload?.statusEmpresa ?? profile?.situacao ?? profile?.status_empresa;
  if (status) return status;
  if (companyPayload?.is_active === false || companyPayload?.isActive === false) return "Inativa";
  return "Ativa";
};

const timelineIconBySeverity = (severity) => {
  const key = normalize(severity);
  if (key.includes("success") || key.includes("ok")) return { icon: CheckCircle2, className: "text-emerald-600" };
  if (key.includes("warning")) return { icon: AlertTriangle, className: "text-amber-600" };
  if (key.includes("danger") || key.includes("critical")) return { icon: CircleAlert, className: "text-red-600" };
  return { icon: Info, className: "text-blue-600" };
};

const EmptyBlock = ({ text = "Sem dados disponíveis." }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100/70 px-4 py-6 text-sm text-slate-600">{text}</div>
);

const DataRow = ({ label, value }) => (
  <div className="grid grid-cols-[minmax(120px,180px)_1fr] gap-3 py-2.5">
    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
    <p className="text-sm text-slate-900 break-words">{value ?? "—"}</p>
  </div>
);

const metricToneClass = {
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  danger: "border-red-300 bg-red-50 text-red-900",
  info: "border-blue-300 bg-blue-50 text-blue-900",
  neutral: "border-slate-300 bg-slate-100 text-slate-700",
};

const SidebarMetricCard = ({ label, value, helper, icon, tone = "neutral" }) => (
  <Card className={`rounded-2xl shadow-none ${metricToneClass[tone] || metricToneClass.neutral}`}>
    <CardContent className="p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
        <span className="rounded-xl border border-current/30 bg-white/60 p-1.5">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value ?? "—"}</p>
      <p className="text-xs opacity-80">{helper}</p>
    </CardContent>
  </Card>
);

const KpiCard = ({ label, value, icon, tone = "neutral" }) => (
  <Card className="rounded-2xl border-slate-200 bg-white shadow-none">
    <CardContent className="flex items-start justify-between p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-semibold text-slate-900">{value ?? "—"}</p>
      </div>
      <Chip variant={tone}>{icon}</Chip>
    </CardContent>
  </Card>
);

const OverviewSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    <div className="h-20 rounded-2xl bg-slate-200" />
    <div className="grid gap-3 md:grid-cols-2">
      <div className="h-16 rounded-2xl bg-slate-200" />
      <div className="h-16 rounded-2xl bg-slate-200" />
    </div>
    <div className="h-64 rounded-2xl bg-slate-200" />
  </div>
);

export default function CompanyOverviewDrawer({ open, onClose, company, state, onEditCompany, onCopy }) {
  const [tab, setTab] = React.useState("geral");
  const [search, setSearch] = React.useState("");
  const { data, loading, error, refetch } = state;

  React.useEffect(() => {
    if (!open) {
      setTab("geral");
      setSearch("");
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    const onEsc = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  const overview = data || {};
  const companyPayload = overview.company || {};
  const summary = overview.summary || {};
  const certificate = overview.certificate || {};
  const score = overview.score || {};
  const profile = overview.profile || {};
  const taxes = Array.isArray(overview.taxes) ? overview.taxes : [];
  const licences = Array.isArray(overview.licences) ? overview.licences : [];
  const processes = Array.isArray(overview.processes) ? overview.processes : [];
  const timeline = Array.isArray(overview.timeline) ? overview.timeline : [];
  const hasData = !loading && !error && !!data;

  const searchTerm = normalize(search);
  const filteredTaxes = React.useMemo(() => {
    if (!searchTerm) return taxes;
    return taxes.filter((item) => normalize(`${item?.tipo} ${item?.competencia} ${item?.status} ${item?.valor}`).includes(searchTerm));
  }, [searchTerm, taxes]);
  const filteredLicences = React.useMemo(() => {
    if (!searchTerm) return licences;
    return licences.filter((item) => normalize(`${item?.tipo} ${item?.origem} ${item?.status}`).includes(searchTerm));
  }, [licences, searchTerm]);
  const filteredProcesses = React.useMemo(() => {
    if (!searchTerm) return processes;
    return processes.filter((item) => normalize(`${item?.titulo} ${item?.situacao} ${item?.protocolo} ${item?.responsavel}`).includes(searchTerm));
  }, [processes, searchTerm]);
  const cnaeResumo = Array.isArray(profile?.cnaes_principal) && profile.cnaes_principal.length > 0
    ? profile.cnaes_principal.map((item) => [item?.code, item?.text].filter(Boolean).join(" - ")).join(" | ")
    : "—";

  const empresaStatus = resolveCompanyStatus(companyPayload, profile);
  const companyRiscoLabel = formatRiskLabel(score?.risk_tier);
  const companyScoreLabel = formatScoreStatusLabel(score?.score_status);
  const cnpjMasked = formatCpfCnpj(companyPayload?.cnpj || companyPayload?.company_cpf) || "—";
  const cpfMasked = formatCpfCnpj(profile?.cpf) || "—";
  const phoneMasked = formatPhoneBr(profile?.telefone) || "—";

  const certStatusKey = getStatusKey(certificate?.status);
  const certDueDate = certificate?.validade ? new Date(certificate.validade) : null;
  const certDaysToExpire = certDueDate ? Math.ceil((certDueDate.getTime() - Date.now()) / 86400000) : null;
  const certVisual = (() => {
    if (certStatusKey.includes("valid")) return { icon: BadgeCheck, label: "Válido", className: "border-emerald-300 bg-emerald-50 text-emerald-800" };
    if ((certStatusKey.includes("expiring") || certStatusKey.includes("vence")) && Number.isFinite(certDaysToExpire)) {
      const days = Math.max(0, Number(certDaysToExpire));
      return { icon: BadgeAlert, label: `Vence em ${days} ${days === 1 ? "dia" : "dias"}`, className: "border-amber-300 bg-amber-50 text-amber-800" };
    }
    return { icon: BadgeAlert, label: "Não possui", className: "border-red-300 bg-red-50 text-red-800" };
  })();
  const CertIcon = certVisual.icon;

  const openCompanyFolder = React.useCallback(() => {
    const dirname = String(companyPayload?.fs_dirname || "").trim();
    if (!dirname || typeof window === "undefined") return;
    const encodedDir = dirname.split("/").map((part) => encodeURIComponent(part)).join("/");
    const path = `G:/EMPRESAS/${encodedDir}`.replace(/\\/g, "/");
    window.open(`file:///${path}`, "_blank", "noopener,noreferrer");
  }, [companyPayload?.fs_dirname]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/65 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="h-[min(92vh,920px)] w-full max-w-[1320px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div data-testid="company-overview-drawer" className="flex h-full flex-col lg:flex-row">
              <aside className="w-full shrink-0 border-b border-slate-200 bg-slate-50 p-4 lg:w-[320px] lg:border-b-0 lg:border-r">
                <div className="space-y-3">
                  <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-4 text-white">
                    <CopyableCompanyName className="!text-white hover:!text-white hover:bg-white/10 disabled:!text-white" value={formatSentence(companyPayload?.razao_social || companyPayload?.empresa || company?.razao_social || company?.empresa)} onCopy={onCopy} size="lg" />
                    <p className="mt-1 text-sm text-slate-200">{formatSentence(companyPayload?.nome_fantasia || company?.nome_fantasia || "—")}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <StatusBadge status={empresaStatus} />
                      <Chip variant={riskChipVariant(score?.risk_tier)}>Risco: {companyRiscoLabel}</Chip>
                      <Chip variant="neutral">Score: {companyScoreLabel}</Chip>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Card className="rounded-2xl border-slate-200 bg-white shadow-none">
                      <CardContent className="p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">CNPJ</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{cnpjMasked}</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-slate-200 bg-white shadow-none">
                      <CardContent className="p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Certificado digital</p>
                        <div className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${certVisual.className}`}>
                          <CertIcon className="h-3.5 w-3.5" />
                          {certVisual.label}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <SidebarMetricCard label="Taxas pendentes" value={summary.pending_taxes_count ?? 0} helper="Exigem ação" icon={<Landmark className="h-4 w-4" />} tone="warning" />
                    <SidebarMetricCard label="Licenças críticas" value={summary.critical_licences_count ?? 0} helper="Risco alto" icon={<TriangleAlert className="h-4 w-4" />} tone="danger" />
                    <SidebarMetricCard label="Processos em aberto" value={summary.open_processes_count ?? 0} helper="Acompanhamento" icon={<Briefcase className="h-4 w-4" />} tone="info" />
                    <SidebarMetricCard label="Alertas ativos" value={summary.has_alerts ? "Sim" : "Não"} helper="Monitoramento" icon={<Bell className="h-4 w-4" />} tone="neutral" />
                  </div>
                  <Card className="rounded-3xl border-slate-200 bg-white shadow-none">
                    <CardContent className="space-y-2 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Contato principal</p>
                      <div className="space-y-1 text-sm text-slate-800">
                        <p><span className="text-slate-500">Telefone:</span> {phoneMasked}</p>
                        <p><span className="text-slate-500">E-mail:</span> {String(profile?.email || "—").toLocaleLowerCase("pt-BR")}</p>
                        <p><span className="text-slate-500">Município/UF:</span> {formatSentence([companyPayload?.municipio, companyPayload?.uf].filter(Boolean).join("/") || "—")}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </aside>
              <section className="flex min-w-0 flex-1 flex-col bg-white">
                <div className="border-b border-slate-200 px-5 pb-4 pt-5 md:px-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Empresas › {formatSentence(companyPayload?.nome_fantasia || companyPayload?.empresa || "Empresa")} › Abrir</p>
                      <h2 className="mt-1 text-2xl font-semibold text-slate-950">Central da empresa</h2>
                      <p className="text-sm text-slate-600">Acompanhe cadastro, taxas, licenças e processos em um único painel.</p>
                    </div>
                    <Button type="button" variant="ghost" className="h-10 w-10 rounded-2xl" onClick={onClose} aria-label="Fechar">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[280px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar taxa, licença ou processo" className="h-11 rounded-2xl border-slate-200 bg-white pl-10" />
                    </div>
                    <Button type="button" variant="outline" className="h-11 rounded-2xl border-slate-300 bg-white text-slate-700 hover:bg-slate-100" onClick={openCompanyFolder}>
                      <ExternalLink className="mr-1.5 h-4 w-4" />
                      Abrir Pasta
                    </Button>
                    {onEditCompany && companyPayload?.id ? (
                      <Button type="button" className="h-11 rounded-2xl bg-slate-950 text-white hover:bg-slate-900" onClick={() => onEditCompany(companyPayload)}>
                        <Pencil className="mr-1.5 h-4 w-4" />
                        Editar
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" className="h-11 rounded-2xl border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100" onClick={refetch}>
                      <RefreshCw className="mr-1.5 h-4 w-4" />
                      Atualizar
                    </Button>
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4 md:px-6 md:pb-6">
                  <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
                    <TabsList className="grid w-full grid-cols-2 gap-2 bg-transparent p-0 md:grid-cols-6">
                      <TabsTrigger value="geral" className="rounded-2xl border border-slate-200 bg-slate-100 text-slate-700 data-[state=active]:border-slate-950 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none">Visão geral</TabsTrigger>
                      <TabsTrigger value="cadastro" className="rounded-2xl border border-slate-200 bg-slate-100 text-slate-700 data-[state=active]:border-slate-950 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none">Cadastro</TabsTrigger>
                      <TabsTrigger value="taxas" className="rounded-2xl border border-slate-200 bg-slate-100 text-slate-700 data-[state=active]:border-slate-950 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none">Taxas</TabsTrigger>
                      <TabsTrigger value="licencas" className="rounded-2xl border border-slate-200 bg-slate-100 text-slate-700 data-[state=active]:border-slate-950 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none">Licenças</TabsTrigger>
                      <TabsTrigger value="processos" className="rounded-2xl border border-slate-200 bg-slate-100 text-slate-700 data-[state=active]:border-slate-950 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none">Processos</TabsTrigger>
                      <TabsTrigger value="timeline" className="rounded-2xl border border-slate-200 bg-slate-100 text-slate-700 data-[state=active]:border-slate-950 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none">Timeline</TabsTrigger>
                    </TabsList>
                    <ScrollArea className="mt-4 min-h-0 flex-1 pr-1">
                      <div className="space-y-4">
        {loading ? <OverviewSkeleton /> : null}
        {!loading && error ? (
          <Card className="rounded-3xl border-red-200 bg-red-50 shadow-none">
            <CardContent className="flex flex-col gap-2 p-4 text-sm text-red-700">
              <p>{error}</p>
              <Button type="button" variant="outline" className="w-fit rounded-2xl border-red-200 bg-white text-red-700 hover:bg-red-100" onClick={refetch}>Tentar novamente</Button>
            </CardContent>
          </Card>
        ) : null}

        {!loading && !error ? (
          <>
            <TabsContent value="geral" className="mt-1 space-y-4" data-testid="company-overview-section-summary">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Taxas pendentes" value={summary.pending_taxes_count ?? 0} icon={<Landmark className="h-5 w-5" />} tone="warning" />
                <KpiCard label="Licenças críticas" value={summary.critical_licences_count ?? 0} icon={<TriangleAlert className="h-5 w-5" />} tone="danger" />
                <KpiCard label="Processos em aberto" value={summary.open_processes_count ?? 0} icon={<Briefcase className="h-5 w-5" />} tone="info" />
                <KpiCard label="Alertas ativos" value={summary.has_alerts ? "Sim" : "Não"} icon={<Bell className="h-5 w-5" />} tone="neutral" />
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <Card className="rounded-3xl border-slate-200 bg-white shadow-none">
                  <CardContent className="space-y-2 p-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Resumo executivo</p>
                    <p className="text-sm text-slate-700">Score de urgência: <span className="font-semibold text-slate-900">{summary.score_urgencia ?? "—"}</span></p>
                    <p className="text-sm text-slate-700">Status de risco: <span className="font-semibold text-slate-900">{score?.risk_tier || "—"}</span></p>
                    <p className="text-sm text-slate-700">Certificado digital: <span className="font-semibold text-slate-900">{certificate?.status || "NOT_FOUND"}</span></p>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-slate-200 bg-white shadow-none">
                  <CardContent className="space-y-2 p-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Próximos vencimentos</p>
                    {Array.isArray(summary.next_due_items) && summary.next_due_items.length > 0 ? (
                      <div className="space-y-2">
                        {summary.next_due_items.slice(0, 4).map((item, idx) => (
                          <div key={`${item.kind}-${idx}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">{item.label || "Item"}</p>
                              <p className="text-xs text-slate-500">{item.status || "Sem status"}</p>
                            </div>
                            <span className="text-xs text-slate-600">{toUiBrDate(item.due_date) || "—"}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyBlock text="Nenhum vencimento relevante no momento." />
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="cadastro" className="mt-1 space-y-3" data-testid="company-overview-section-cadastro">
              <div className="grid gap-3 lg:grid-cols-2">
                <Card className="rounded-3xl border-slate-200 bg-white shadow-none">
                  <CardContent className="p-5">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Dados cadastrais</p>
                    <div className="divide-y divide-slate-100">
                      <DataRow label="Razão social" value={formatSentence(companyPayload?.razao_social || companyPayload?.empresa)} />
                      <DataRow label="CNPJ" value={cnpjMasked} />
                      <DataRow label="IE" value={profile?.inscricao_estadual} />
                      <DataRow label="IM" value={profile?.inscricao_municipal} />
                      <DataRow label="CNAE" value={cnaeResumo} />
                      <DataRow label="Grupo" value={formatSentence(profile?.categoria || "—")} />
                      <DataRow label="Apelido de pasta" value={companyPayload?.fs_dirname} />
                    </div>
                  </CardContent>
                </Card>
                <div className="space-y-3">
                  <Card className="rounded-3xl border-slate-200 bg-white shadow-none">
                    <CardContent className="p-5">
                      <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500"><Chip variant="neutral"><Building2 className="h-3 w-3" /> Dados cadastrais</Chip></p>
                      <div className="divide-y divide-slate-100">
                        <DataRow label="Município" value={formatSentence(companyPayload?.municipio || profile?.cidade || "—")} />
                        <DataRow label="UF" value={formatSentence(companyPayload?.uf || profile?.estado || "—")} />
                        <DataRow label="Situação" value={formatSentence(profile?.situacao || companyPayload?.status_empresa || "—")} />
                        <DataRow label="Status score" value={companyScoreLabel} />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-3xl border-slate-200 bg-white shadow-none">
                    <CardContent className="p-5">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Atividades</p>
                      <div className="divide-y divide-slate-100">
                        <DataRow
                          label="Principal"
                          value={Array.isArray(profile?.cnaes_principal) && profile.cnaes_principal.length > 0
                            ? profile.cnaes_principal.map((item) => [item?.code, formatSentence(item?.text)].filter(Boolean).join(" - ")).join(" | ")
                            : "—"}
                        />
                        <DataRow
                          label="Secundárias"
                          value={Array.isArray(profile?.cnaes_secundarios) && profile.cnaes_secundarios.length > 0
                            ? profile.cnaes_secundarios.map((item) => [item?.code, formatSentence(item?.text)].filter(Boolean).join(" - ")).join(" | ")
                            : "—"}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-3xl border-slate-200 bg-white shadow-none">
                    <CardContent className="p-5">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Responsável principal</p>
                      <div className="divide-y divide-slate-100">
                        <DataRow label="Nome" value={formatSentence(profile?.proprietario_principal || profile?.responsavel_fiscal || "—")} />
                        <DataRow label="CPF" value={cpfMasked} />
                        <DataRow label="Telefone" value={phoneMasked} />
                        <DataRow label="E-mail" value={String(profile?.email || "—").toLocaleLowerCase("pt-BR")} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="taxas" className="mt-1 space-y-3" data-testid="company-overview-section-taxes">
              <Card className="overflow-hidden rounded-3xl border-slate-200 bg-white shadow-none">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="hover:bg-slate-50">
                        <TableHead>Taxa</TableHead>
                        <TableHead>Competência</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTaxes.length > 0 ? filteredTaxes.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-slate-900">{item.tipo || "—"}</TableCell>
                          <TableCell>{item.competencia || "—"}</TableCell>
                          <TableCell>{toUiBrDate(item.vencimento) || "—"}</TableCell>
                          <TableCell>{item.valor || "—"}</TableCell>
                          <TableCell><StatusBadge status={item.status || "Sem status"} /></TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={5}><EmptyBlock text={searchTerm ? "Nenhuma taxa corresponde à pesquisa." : "Sem taxas relevantes para esta empresa."} /></TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="licencas" className="mt-1 space-y-3" data-testid="company-overview-section-licences">
              {filteredLicences.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredLicences.map((item, idx) => (
                    <Card key={`${item.tipo}-${idx}`} className="rounded-3xl border-slate-200 bg-white shadow-none">
                      <CardContent className="space-y-2 p-4">
                        <p className="text-sm font-semibold text-slate-900">{item.tipo || "Licença"}</p>
                        <p className="text-sm text-slate-600">Origem: {item.origem || "—"}</p>
                        <p className="text-sm text-slate-600">Validade: {toUiBrDate(item.validade) || "—"}</p>
                        <Chip variant={item.critical ? "danger" : "success"}>{item.status || "Sem status"}</Chip>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : <EmptyBlock text={searchTerm ? "Nenhuma licença corresponde à pesquisa." : "Sem licenças encontradas para esta empresa."} />}
            </TabsContent>

            <TabsContent value="processos" className="mt-1 space-y-3" data-testid="company-overview-section-processes">
              {filteredProcesses.length > 0 ? filteredProcesses.map((item) => (
                <Card key={item.id} className="rounded-3xl border-slate-200 bg-white shadow-none">
                  <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-[240px] space-y-1">
                      <p className="text-sm font-semibold text-slate-900">{item.titulo || "Processo"}</p>
                      <p className="text-xs text-slate-500">Protocolo: {item.protocolo || "—"}</p>
                      <p className="text-xs text-slate-500">Atualização: {toUiBrDate(item.ultima_atualizacao) || "—"}</p>
                      <p className="text-xs text-slate-500">Responsável: {item.responsavel || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Chip variant={item.stalled ? "warning" : "info"}>{item.situacao || "Sem situação"}</Chip>
                      <Button type="button" variant="outline" className="rounded-2xl border-slate-300 bg-white text-slate-700 hover:bg-slate-100">Abrir processo</Button>
                    </div>
                  </CardContent>
                </Card>
              )) : <EmptyBlock text={searchTerm ? "Nenhum processo corresponde à pesquisa." : "Sem processos em andamento para esta empresa."} />}
            </TabsContent>

            <TabsContent value="timeline" className="mt-1 space-y-3" data-testid="company-overview-section-timeline">
              {timeline.length > 0 ? timeline.map((item, idx) => {
                const visual = timelineIconBySeverity(item.severity);
                const Icon = visual.icon;
                return (
                  <Card key={`${item.kind}-${idx}`} className="rounded-3xl border-slate-200 bg-white shadow-none">
                    <CardContent className="flex items-start gap-3 p-4">
                      <span className={`mt-0.5 rounded-xl border border-slate-200 bg-slate-50 p-2 ${visual.className}`}><Icon className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.title || "Evento"}</p>
                          <span className="text-xs text-slate-500">{toUiBrDate(item.happened_at) || "—"}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{item.description || "—"}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              }) : <EmptyBlock text="Sem eventos recentes para exibir." />}
            </TabsContent>
          </>
        ) : null}

        {!loading && !error && !hasData ? (
          <Card className="rounded-3xl border-slate-200 bg-white shadow-none">
            <CardContent className="p-6 text-center text-slate-600">
              <Building2 className="mx-auto mb-2 h-5 w-5" />
              Nenhum dado de overview encontrado para esta empresa.
            </CardContent>
          </Card>
        ) : null}

        {!loading && !error && hasData && !certificate.exists ? (
          <Card className="rounded-3xl border-amber-200 bg-amber-50 shadow-none">
            <CardContent className="flex items-center gap-2 p-3 text-sm text-amber-800">
              <ShieldX className="h-4 w-4" />
              Empresa sem certificado vinculado no momento.
            </CardContent>
          </Card>
        ) : null}
                      </div>
                    </ScrollArea>
                  </Tabs>
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
