import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleCheckBig,
  ChevronRight,
  CircleAlert,
  CircleMinus,
  CircleX,
  FileText,
  FolderKanban,
  FolderOpen,
  Info,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldX,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/Chip";
import StatusBadge from "@/components/StatusBadge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { toUiBrDate } from "@/lib/date";
import { formatCpfCnpj, formatPhoneBr, normalizeText } from "@/lib/text";
import { getStatusKey } from "@/lib/status";

const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const formatSentence = (value) => {
  const text = normalizeText(value).trim();
  if (!text) return "-";
  const lower = text.toLocaleLowerCase("pt-BR");
  return `${lower.charAt(0).toLocaleUpperCase("pt-BR")}${lower.slice(1)}`;
};

const formatCityName = (value) => {
  const text = String(value || "").trim();
  if (!text) return "-";
  const lower = text.toLocaleLowerCase("pt-BR");
  return `${lower.charAt(0).toLocaleUpperCase("pt-BR")}${lower.slice(1)}`;
};

const formatUf = (value) => {
  const text = String(value || "").trim();
  return text ? text.toLocaleUpperCase("pt-BR") : "-";
};

const formatEnumLabel = (value) => {
  const text = String(value || "").trim();
  if (!text) return EMPTY_VALUE;
  return text
    .toLocaleLowerCase("pt-BR")
    .split("_")
    .map((part) => (part ? `${part.charAt(0).toLocaleUpperCase("pt-BR")}${part.slice(1)}` : ""))
    .join(" ");
};

const formatContactPhone = (value) => {
  const rawDigits = String(value || "").replace(/\D/g, "");
  if (!rawDigits) return "-";
  let digits = rawDigits;
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length > 11) digits = digits.slice(-11);
  if (digits.length < 10) return formatPhoneBr(value) || "-";
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length === 9) return `(${ddd}) ${number[0]} ${number.slice(1, 5)}-${number.slice(5)}`;
  if (number.length === 8) return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  return formatPhoneBr(value) || "-";
};

const toDayMonth = (dateValue) => {
  const fullDate = toUiBrDate(dateValue);
  if (!fullDate || fullDate === "-") return "";
  const [day, month] = String(fullDate).split("/");
  if (!day || !month) return "";
  return `${day}/${month}`;
};

const EMPTY_VALUE = "—";

const formatRiskLabel = (value) => {
  const key = String(value || "").trim().toLowerCase();
  if (key === "high") return "Alto";
  if (key === "medium") return "Médio";
  if (key === "low") return "Baixo";
  return EMPTY_VALUE;
};

const formatScoreStatusLabel = (status) => {
  const key = String(status || "").trim().toUpperCase();
  if (key === "OK") return "Ok";
  if (key === "OK_DEFINITIVE") return "Ok - Alvará definitivo";
  if (key === "DEFINITIVE_INVALIDATED") return "Definitivo invalidado";
  if (key === "NO_CNAE") return "Sem CNAE";
  if (key === "UNMAPPED_CNAE") return "CNAE não mapeado";
  if (key === "NO_LICENCE") return "Sem licença datada";
  return formatSentence(status);
};

const formatRegulatoryStatusLabel = (status, hasDefinitive) => {
  const key = String(status || "").trim().toUpperCase();
  if (!hasDefinitive || key === "NOT_APPLICABLE") return "Não aplicável";
  if (key === "VALID") return "Definitivo válido";
  if (key === "INVALIDATED") return "Definitivo invalidado";
  return formatSentence(status);
};

const riskChipVariant = (risk) => {
  const key = String(risk || "").trim().toLowerCase();
  if (key === "high") return "danger";
  if (key === "medium") return "warning";
  if (key === "low") return "success";
  return "neutral";
};

const resolveCompanyStatus = (companyPayload, profile) => {
  const status = companyPayload?.status_empresa ?? companyPayload?.statusEmpresa ?? profile?.situacao ?? profile?.status_empresa;
  if (status) return status;
  if (companyPayload?.is_active === false || companyPayload?.isActive === false) return "Inativa";
  return "Ativa";
};

const timelineVisual = (item) => {
  const kindKey = normalize(item?.kind || item?.type || item?.title || "");
  const severityKey = normalize(item?.severity || item?.status || "");
  if (kindKey.includes("process") || kindKey.includes("func") || kindKey.includes("protocolo")) {
    return { icon: FolderKanban };
  }
  if (kindKey.includes("cert") || kindKey.includes("digital")) {
    return { icon: CircleCheckBig };
  }
  if (severityKey.includes("danger") || severityKey.includes("critical")) {
    return { icon: CircleAlert };
  }
  if (severityKey.includes("warning")) {
    return { icon: AlertTriangle };
  }
  return { icon: CalendarClock };
};

const EmptyBlock = ({ text = "Sem dados disponíveis." }) => <div className="ec-modal-empty">{text}</div>;

const resolveProcessId = (item) =>
  String(item?.id ?? item?.process_id ?? item?.processId ?? item?.processo_id ?? "").trim();

const DataRow = ({ label, value }) => (
  <div className="ec-modal-field-row">
    <label>{label}</label>
    <div className="ec-modal-field-value">{value ?? EMPTY_VALUE}</div>
  </div>
);

const sidebarKpiClass = {
  warning: "ec-modal-kpi-warn",
  danger: "ec-modal-kpi-danger",
  info: "ec-modal-kpi-blue",
  neutral: "ec-modal-kpi-neutral",
};

const SidebarMetricCard = ({ label, value, helper, icon, tone = "neutral" }) => (
  <div className={`ec-modal-kpi ${sidebarKpiClass[tone] || sidebarKpiClass.neutral}`}>
    <div className="ec-modal-kpi-icon">{icon}</div>
    <div>
      <label>{label}</label>
      <div className="ec-modal-kpi-value">{value ?? EMPTY_VALUE}</div>
      {helper && <small>{helper}</small>}
    </div>
  </div>
);

const overviewKpiClass = {
  warning: "ec-modal-overview-kpi-warn",
  danger: "ec-modal-overview-kpi-danger",
  info: "ec-modal-overview-kpi-info",
  neutral: "",
};

const KpiCard = ({ label, value, icon, tone = "neutral" }) => (
  <div className={`ec-modal-overview-kpi ${overviewKpiClass[tone] || ""}`}>
    <div className="ec-modal-overview-kpi-icon">{icon}</div>
    <div>
      <label>{label}</label>
      <div className="ec-modal-overview-kpi-value">{value ?? EMPTY_VALUE}</div>
    </div>
  </div>
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

const MODAL_TABS = [
  { id: "geral", label: "Visão geral" },
  { id: "cadastro", label: "Cadastro" },
  { id: "taxas", label: "Taxas" },
  { id: "licencas", label: "Licenças" },
  { id: "processos", label: "Processos" },
  { id: "timeline", label: "Timeline" },
];

export default function CompanyOverviewDrawer({ open, onClose, company, state, onEditCompany }) {
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
  const regulatory = overview.regulatory || {};
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
    : EMPTY_VALUE;

  const empresaStatus = resolveCompanyStatus(companyPayload, profile);
  const companyRiscoLabel = formatRiskLabel(score?.risk_tier);
  const companyScoreLabel = formatScoreStatusLabel(score?.score_status);
  const regulatoryLabel = formatRegulatoryStatusLabel(regulatory?.regulatory_status, regulatory?.has_definitive_alvara);
  const invalidatedReasonsLabel = Array.isArray(regulatory?.invalidated_reasons) && regulatory.invalidated_reasons.length > 0
    ? regulatory.invalidated_reasons.map((item) => formatEnumLabel(item)).join(", ")
    : EMPTY_VALUE;
  const cnpjMasked = formatCpfCnpj(companyPayload?.cnpj || companyPayload?.company_cpf) || EMPTY_VALUE;
  const cpfMasked = formatCpfCnpj(profile?.cpf) || EMPTY_VALUE;
  const phoneMasked = formatContactPhone(profile?.telefone);
  const municipioFormatted = formatCityName(companyPayload?.municipio || profile?.cidade || "");
  const ufFormatted = formatUf(companyPayload?.uf || profile?.estado || "");

  const certStatusKey = getStatusKey(certificate?.status);
  const certVisual = (() => {
    if (certStatusKey.includes("valid")) return { statusCls: "ec-s-cert-ok", label: "VÁLIDO", icon: CircleCheckBig };
    if (certStatusKey.includes("expiring") || certStatusKey.includes("vence")) return { statusCls: "ec-s-cert-warn", label: "EXPIRING", icon: CircleAlert };
    if (certStatusKey.includes("expired") || certStatusKey.includes("vencid")) return { statusCls: "ec-s-cert-danger", label: "EXPIRED", icon: CircleMinus };
    return { statusCls: "ec-s-cert-danger", label: "NÃO POSSUI", icon: CircleX };
  })();
  const CertStatusIcon = certVisual.icon;

  const openCompanyFolder = React.useCallback(() => {
    const dirname = String(companyPayload?.fs_dirname || "").trim();
    if (!dirname || typeof window === "undefined") return;
    const encodedDir = dirname.split("/").map((part) => encodeURIComponent(part)).join("/");
    const path = `G:/EMPRESAS/${encodedDir}`.replace(/\\/g, "/");
    window.open(`file:///${path}`, "_blank", "noopener,noreferrer");
  }, [companyPayload?.fs_dirname]);

  const openProcessDrawer = React.useCallback(
    (item) => {
      const processId = resolveProcessId(item);
      if (!processId || typeof window === "undefined") return;
      onClose?.();
      window.dispatchEvent(
        new CustomEvent("econtrole:open-process", {
          detail: { mode: "edit", processId },
        }),
      );
    },
    [onClose],
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="ec-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="ec-modal"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div data-testid="company-overview-drawer" className="flex h-full flex-col lg:flex-row">
              <aside className="ec-modal-sidebar">
                {(() => {
                  const nomeFantasia = formatSentence(companyPayload?.nome_fantasia || company?.nome_fantasia || "");
                  const razaoSocial = formatSentence(companyPayload?.razao_social || companyPayload?.empresa || company?.razao_social || company?.empresa || "");
                  const initials = nomeFantasia.split(" ").filter((w) => w.length > 2).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "EC";
                  return (
                    <div className="ec-modal-company-id">
                      <div className="ec-modal-company-avatar">{initials}</div>
                      <div className="ec-modal-company-name">
                        <h3>{nomeFantasia || EMPTY_VALUE}</h3>
                        <span>{razaoSocial || EMPTY_VALUE}</span>
                      </div>
                      <div className="ec-modal-company-badges">
                        <StatusBadge status={empresaStatus} className="ec-chip-square" />
                        <Chip variant={riskChipVariant(score?.risk_tier)} className="ec-chip-square">Risco: {companyRiscoLabel}</Chip>
                        <Chip variant="neutral" className="ec-chip-square">Score: {companyScoreLabel}</Chip>
                      </div>
                    </div>
                  );
                })()}
                <div className="ec-modal-info-section">
                  <div className="ec-modal-info-row">
                    <label>CNPJ</label>
                    <span style={{ fontFamily: "monospace", fontSize: 11 }}>{cnpjMasked}</span>
                  </div>
                  <div className="ec-modal-info-row">
                    <label>Certificado digital</label>
                    <span className={`ec-status ec-s-cert ${certVisual.statusCls}`}>
                      <CertStatusIcon size={12} strokeWidth={1.9} />
                      {certVisual.label}
                    </span>
                  </div>
                </div>
                <div className="ec-modal-kpi-grid">
                  <SidebarMetricCard label="Taxas pendentes" value={summary.pending_taxes_count ?? 0} helper="Exigem ação" icon={<Receipt className="h-4 w-4" />} tone="warning" />
                  <SidebarMetricCard label="Licenças críticas" value={summary.critical_licences_count ?? 0} helper="Risco alto" icon={<ShieldAlert className="h-4 w-4" />} tone="danger" />
                  <SidebarMetricCard label="Processos em aberto" value={summary.open_processes_count ?? 0} helper="Acompanhamento" icon={<FolderKanban className="h-4 w-4" />} tone="info" />
                  <SidebarMetricCard label="Alertas ativos" value={summary.has_alerts ? "Sim" : "Não"} helper="Monitoramento" icon={<Bell className="h-4 w-4" />} tone="neutral" />
                </div>
                <div className="ec-modal-contact">
                  <label className="ec-modal-section-label">Contato principal</label>
                  <div className="ec-modal-contact-row"><Phone size={12} strokeWidth={1.6} />{phoneMasked}</div>
                  <div className="ec-modal-contact-row"><Mail size={12} strokeWidth={1.6} />{String(profile?.email || EMPTY_VALUE).toLocaleLowerCase("pt-BR")}</div>
                  <div className="ec-modal-contact-row"><MapPin size={12} strokeWidth={1.6} />{[municipioFormatted, ufFormatted].filter((part) => part && part !== "-").join(" / ") || EMPTY_VALUE}</div>
                </div>
              </aside>
              <section className="ec-modal-main">
                <div className="ec-modal-header">
                  <div className="ec-modal-breadcrumb">
                    <span>Empresas</span>
                    <ChevronRight size={12} />
                    <span>{formatSentence(companyPayload?.nome_fantasia || companyPayload?.empresa || "Empresa")}</span>
                    <ChevronRight size={12} />
                    <span>Abrir</span>
                  </div>
                  <div className="ec-modal-title-row">
                    <div>
                      <h2>Central da empresa</h2>
                      <p>Acompanhe cadastro, taxas, licenças e processos em um único painel.</p>
                    </div>
                    <button type="button" className="ec-modal-close" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
                  </div>
                  <div className="ec-modal-toolbar">
                    <div className="ec-modal-search">
                      <Search size={14} strokeWidth={1.6} />
                      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar taxa, licença ou processo…" />
                    </div>
                    <div className="ec-modal-actions">
                      <button type="button" className="ec-btn-ghost" onClick={openCompanyFolder}><FolderOpen size={14} strokeWidth={1.6} />Abrir Pasta</button>
                      {onEditCompany && companyPayload?.id ? (
                        <button type="button" className="ec-btn-primary" onClick={() => onEditCompany(companyPayload)}><Pencil size={14} strokeWidth={1.6} />Editar</button>
                      ) : null}
                      <button type="button" className="ec-btn-ghost" onClick={refetch}><RefreshCw size={14} strokeWidth={1.6} />Atualizar</button>
                    </div>
                  </div>
                  <div className="ec-modal-tabs">
                    {MODAL_TABS.map((t) => (
                      <button key={t.id} type="button" className={`ec-modal-tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
                    ))}
                  </div>
                </div>
                <Tabs value={tab} onValueChange={setTab} className="ec-modal-body">
                  <div>
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
            <TabsContent value="geral" className="space-y-4" data-testid="company-overview-section-summary">
              <div className="ec-modal-overview-kpis">
                <KpiCard label="Taxas pendentes" value={summary.pending_taxes_count ?? 0} icon={<Receipt size={18} strokeWidth={1.6} />} tone="warning" />
                <KpiCard label="Licenças críticas" value={summary.critical_licences_count ?? 0} icon={<ShieldAlert size={18} strokeWidth={1.6} />} tone="danger" />
                <KpiCard label="Processos em aberto" value={summary.open_processes_count ?? 0} icon={<FolderKanban size={18} strokeWidth={1.6} />} tone="info" />
                <KpiCard label="Alertas ativos" value={summary.has_alerts ? "Sim" : "Não"} icon={<Bell size={18} strokeWidth={1.6} />} tone="neutral" />
              </div>
              <div className="ec-modal-overview-grid">
                <div className="ec-modal-section-card">
                  <div className="ec-modal-section-card-head"><FileText size={14} strokeWidth={1.6} /><h4>Resumo executivo</h4></div>
                  <div className="ec-modal-exec-rows">
                    <div className="ec-modal-exec-row"><span>Score de urgência</span><strong>{summary.score_urgencia ?? EMPTY_VALUE}</strong></div>
                    <div className="ec-modal-exec-row"><span>Status de risco</span><strong>{score?.risk_tier || EMPTY_VALUE}</strong></div>
                    <div className="ec-modal-exec-row"><span>Status do certificado</span><strong>{certVisual.label}</strong></div>
                    <div className="ec-modal-exec-row"><span>Status regulatório do alvará</span><strong>{regulatoryLabel}</strong></div>
                    <div className="ec-modal-exec-row"><span>Novo pedido exigido</span><strong>{summary?.requires_new_licence_request ? "Sim" : "Não"}</strong></div>
                  </div>
                </div>
                <div className="ec-modal-section-card">
                  <div className="ec-modal-section-card-head"><CalendarClock size={14} strokeWidth={1.6} /><h4>Próximos vencimentos</h4></div>
                  {Array.isArray(summary.next_due_items) && summary.next_due_items.length > 0 ? (
                    <div className="ec-modal-upcoming">
                      {summary.next_due_items.slice(0, 4).map((item, idx) => (
                        <div key={`${item.kind}-${idx}`} className="ec-modal-upcoming-row">
                          <div>
                            <div className="ec-modal-upcoming-name">{item.label || "Item"}</div>
                            <div className="ec-modal-upcoming-sub">{item.status || "Sem status"}</div>
                          </div>
                          <span className="ec-status ec-s-neutral">{toUiBrDate(item.due_date) || "-"}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyBlock text="Nenhum vencimento relevante no momento." />
                  )}
                </div>
              </div>
              {regulatory?.has_definitive_alvara ? (
                <div className="ec-modal-section-card">
                  <div className="ec-modal-section-card-head"><ShieldAlert size={14} strokeWidth={1.6} /><h4>Regra do alvará definitivo</h4></div>
                  <div className="ec-modal-field-grid">
                    <DataRow label="Status" value={regulatoryLabel} />
                    <DataRow label="Novo pedido" value={regulatory?.requires_new_licence_request ? "Solicitar novo alvará" : "Não exigido"} />
                    <DataRow label="Motivos" value={invalidatedReasonsLabel} />
                    <DataRow label="Processo relacionado" value={regulatory?.invalidating_process_ref || EMPTY_VALUE} />
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="cadastro" data-testid="company-overview-section-cadastro" className="ec-modal-cadastro w-full">
              <div className="ec-modal-section-card">
                <div className="ec-modal-section-card-head"><Building2 size={14} strokeWidth={1.6} /><h4>Dados cadastrais</h4></div>
                <div className="ec-modal-field-grid">
                  <DataRow label="Razão social" value={formatSentence(companyPayload?.razao_social || companyPayload?.empresa)} />
                  <DataRow label="CNPJ" value={cnpjMasked} />
                  <DataRow label="IE" value={profile?.inscricao_estadual} />
                  <DataRow label="IM" value={profile?.inscricao_municipal} />
                  <DataRow label="CNAE" value={cnaeResumo} />
                  <DataRow label="Grupo" value={formatSentence(profile?.categoria || "-")} />
                  <DataRow label="Complexidade sanitária" value={formatEnumLabel(profile?.sanitary_complexity)} />
                  <DataRow label="Apelido de pasta" value={companyPayload?.fs_dirname} />
                </div>
              </div>
              <div className="ec-modal-section-card">
                <div className="ec-modal-section-card-head"><MapPin size={14} strokeWidth={1.6} /><h4>Localização e situação</h4></div>
                <div className="ec-modal-field-grid">
                  <DataRow label="Município" value={municipioFormatted} />
                  <DataRow label="UF" value={ufFormatted} />
                  <DataRow label="Uso do endereço" value={formatEnumLabel(profile?.address_usage_type)} />
                  <DataRow label="Local do endereço" value={formatEnumLabel(profile?.address_location_type)} />
                  <DataRow label="Situação" value={formatSentence(profile?.situacao || companyPayload?.status_empresa || EMPTY_VALUE)} />
                  <DataRow label="Status score" value={companyScoreLabel} />
                </div>
              </div>
              <div className="ec-modal-section-card">
                <div className="ec-modal-section-card-head"><FileText size={14} strokeWidth={1.6} /><h4>Atividades</h4></div>
                <div className="ec-modal-field-grid">
                  <DataRow
                    label="Principal"
                    value={Array.isArray(profile?.cnaes_principal) && profile.cnaes_principal.length > 0
                      ? profile.cnaes_principal.map((item) => [item?.code, formatSentence(item?.text)].filter(Boolean).join(" - ")).join(" | ")
                      : "-"}
                  />
                  <DataRow
                    label="Secundárias"
                    value={Array.isArray(profile?.cnaes_secundarios) && profile.cnaes_secundarios.length > 0
                      ? (
                        <ul className="ec-modal-cnae-list">
                          {profile.cnaes_secundarios.map((item, idx) => (
                            <li key={`${item?.code || "cnae"}-${idx}`}>
                              {[item?.code, formatSentence(item?.text)].filter(Boolean).join(" - ")}
                            </li>
                          ))}
                        </ul>
                      )
                      : "-"}
                  />
                </div>
              </div>
              <div className="ec-modal-section-card">
                <div className="ec-modal-section-card-head"><Building2 size={14} strokeWidth={1.6} /><h4>Responsável principal</h4></div>
                <div className="ec-modal-field-grid">
                  <DataRow label="Nome" value={formatSentence(profile?.proprietario_principal || profile?.responsavel_fiscal || "-")} />
                  <DataRow label="CPF" value={cpfMasked} />
                  <DataRow label="Telefone" value={phoneMasked} />
                  <DataRow label="E-mail" value={String(profile?.email || "-").toLocaleLowerCase("pt-BR")} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="taxas" data-testid="company-overview-section-taxes" className="w-full">
              <div className="ec-modal-table-wrap">
                <table className="ec-modal-table">
                  <thead>
                    <tr>
                      <th>Taxa</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTaxes.length > 0 ? filteredTaxes.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 500 }}>
                          <div>{item.tipo || "-"}</div>
                          {normalize(item?.tipo).includes("tpi") && toDayMonth(item?.vencimento) ? (
                            <small className="ec-tax-venc-chip">Vence: {toDayMonth(item?.vencimento)}</small>
                          ) : null}
                        </td>
                        <td><StatusBadge status={item.status || "Sem status"} className="ec-chip-square" /></td>
                      </tr>
                    )) : (
                      <tr><td colSpan={2}><EmptyBlock text={searchTerm ? "Nenhuma taxa corresponde à pesquisa." : "Sem taxas relevantes para esta empresa."} /></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="licencas" data-testid="company-overview-section-licences" className="w-full">
              {filteredLicences.length > 0 ? (
                <div className="ec-modal-licence-grid">
                  {filteredLicences.map((item, idx) => {
                    const borderCls = item.critical ? "ec-licence-card-danger" : "ec-licence-card-ok";
                    return (
                      <div key={`${item.tipo}-${idx}`} className={`ec-modal-licence-card ${borderCls}`}>
                        <div className="ec-modal-licence-card-head">
                          <span className="ec-modal-licence-card-name">{item.tipo || "Licença"}</span>
                          <span className={`ec-status ${item.critical ? "ec-s-danger" : "ec-s-ok"}`}>{item.status || "Sem status"}</span>
                        </div>
                        <div className="ec-modal-licence-card-meta">
                          <span>Origem: {item.origem || "-"}</span>
                          {item.alvara_funcionamento_kind ? (
                            <span>Tipo: {formatEnumLabel(item.alvara_funcionamento_kind)}</span>
                          ) : null}
                          {item.regulatory_status ? (
                            <span>Status regulatório: {formatRegulatoryStatusLabel(item.regulatory_status, Boolean(item.alvara_funcionamento_kind))}</span>
                          ) : null}
                          {item.requires_new_licence_request ? (
                            <span>Novo pedido: obrigatório</span>
                          ) : null}
                          {Array.isArray(item.invalidated_reasons) && item.invalidated_reasons.length > 0 ? (
                            <span>Motivos: {item.invalidated_reasons.map((reason) => formatEnumLabel(reason)).join(", ")}</span>
                          ) : null}
                          {item.invalidating_process_ref ? (
                            <span>Processo: {item.invalidating_process_ref}</span>
                          ) : null}
                          <span>Validade: {toUiBrDate(item.validade) || "-"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyBlock text={searchTerm ? "Nenhuma licença corresponde à pesquisa." : "Sem licenças encontradas para esta empresa."} />}
            </TabsContent>

            <TabsContent value="processos" data-testid="company-overview-section-processes" className="w-full">
              {filteredProcesses.length > 0 ? (
                <div className="ec-modal-process-list">
                  {filteredProcesses.map((item) => (
                    <div key={item.id} className="ec-modal-process-row">
                      <div className="ec-modal-process-row-main">
                        <div>
                          <div className="ec-modal-process-type">{item.titulo || "Processo"}</div>
                          <div className="ec-modal-process-meta">
                            Protocolo: {item.protocolo || EMPTY_VALUE} · Atualização: {toUiBrDate(item.ultima_atualizacao) || EMPTY_VALUE} · Responsável: {item.responsavel || EMPTY_VALUE}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Chip variant={item.stalled ? "warning" : "info"} className="ec-chip-square">{item.situacao || "Sem situação"}</Chip>
                          <button
                            type="button"
                            className="ec-btn-ghost"
                            style={{ padding: "4px 10px", fontSize: 12 }}
                            onClick={() => openProcessDrawer(item)}
                          >
                            Abrir processo
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyBlock text={searchTerm ? "Nenhum processo corresponde à pesquisa." : "Sem processos em andamento para esta empresa."} />}
            </TabsContent>

            <TabsContent value="timeline" data-testid="company-overview-section-timeline" className="w-full">
              {timeline.length > 0 ? (
                <div className="ec-modal-timeline">
                  {timeline.map((item, idx) => {
                    const visual = timelineVisual(item);
                    const Icon = visual.icon;
                    return (
                      <div key={`${item.kind}-${idx}`} className="ec-modal-timeline-item">
                        <div className="ec-modal-timeline-dot"><Icon size={14} strokeWidth={1.6} /></div>
                        <div className="ec-modal-timeline-content">
                          <div className="ec-modal-timeline-title">{item.title || "Evento"}</div>
                          <div className="ec-modal-timeline-desc">{item.description || EMPTY_VALUE}</div>
                          <div className="ec-modal-timeline-date">{toUiBrDate(item.happened_at) || EMPTY_VALUE}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyBlock text="Sem eventos recentes para exibir." />}
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
                </Tabs>
              </section>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
