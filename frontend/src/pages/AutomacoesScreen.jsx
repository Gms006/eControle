import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Bot, Building2, Clock3, FolderKanban, LayoutDashboard, Play, Receipt, RefreshCw, ScrollText, ShieldCheck, Wrench, X, Zap } from "lucide-react";
import { fetchJson } from "@/lib/api";

const AUTOMACOES_UI_STATE_KEY = "econtrole:automacoes:ui-state";

const SUBNAV_ITEMS = [
  { key: "painel", label: "Painel", icon: LayoutDashboard },
  { key: "empresas", label: "Empresas", icon: Building2 },
  { key: "licencas", label: "Licenças", icon: ScrollText },
  { key: "taxas", label: "Taxas", icon: Receipt },
  { key: "processos", label: "Processos", icon: FolderKanban },
  { key: "certificados", label: "Certificados", icon: ShieldCheck },
  { key: "automacoes", label: "Automações", icon: Bot },
];

const JOB_TYPE_LABELS = {
  receitaws_bulk_sync: "ReceitaWS Bulk Sync",
  licence_scan_full: "Scan Completo de Licenças",
  tax_portal_sync: "Tax Portal Sync",
  notification_operational_scan: "Scan Operacional de Notificações",
};

const JOB_TYPE_DOMAINS = {
  receitaws_bulk_sync: "Empresas",
  licence_scan_full: "Licenças",
  tax_portal_sync: "Taxas",
  notification_operational_scan: "Processos",
};

const JOB_CATALOG_BASE = [
  { job_type: "receitaws_bulk_sync", owner: "Dados" },
  { job_type: "licence_scan_full", owner: "Operações" },
  { job_type: "tax_portal_sync", owner: "Fiscal" },
  { job_type: "notification_operational_scan", owner: "Operações" },
];

const formatTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const formatDuration = (start, end) => {
  if (!start || !end) return "-";
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return "-";
  const seconds = Math.round((e - s) / 1000);
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${String(mins).padStart(2, "0")}m ${String(rem).padStart(2, "0")}s`;
};

const prettyStatus = (status) => {
  if (status === "running") return "rodando";
  if (status === "failed") return "falhou";
  if (status === "queued") return "agendado";
  if (status === "completed") return "concluido";
  if (status === "cancelled") return "cancelado";
  if (status === "sem_execucao") return "sem execucao";
  return status || "desconhecido";
};

const jobStatusClass = (status) => {
  if (status === "running") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "cancelled" || status === "sem_execucao") return "border-slate-300 bg-slate-100 text-slate-700";
  if (status === "completed") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
};

const sevClass = (severity) =>
  severity === "alta"
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : "border-amber-200 bg-amber-50 text-amber-700";

export default function AutomacoesScreen({
  activeTab = "automacoes",
  onTabChange,
  enqueueToast,
  workerHealth,
}) {
  const loadSavedUiState = () => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem(AUTOMACOES_UI_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  };
  const savedUiState = loadSavedUiState();

  const [jobs, setJobs] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loadingRealtime, setLoadingRealtime] = useState(false);
  const [domainFilter, setDomainFilter] = useState(savedUiState?.domainFilter || "Todos");
  const [statusFilter, setStatusFilter] = useState(savedUiState?.statusFilter || "Todos");
  const [ownerFilter, setOwnerFilter] = useState(savedUiState?.ownerFilter || "Todos");
  const [onlyFailed, setOnlyFailed] = useState(savedUiState?.onlyFailed === true);
  const [timeWindow, setTimeWindow] = useState(savedUiState?.timeWindow || "24h");
  const [viewMode, setViewMode] = useState(savedUiState?.viewMode || "operacao");

  const loadRealtimeData = useCallback(async () => {
    setLoadingRealtime(true);
    try {
      const payload = await fetchJson("/api/v1/worker/snapshot");
      setJobs(Array.isArray(payload?.jobs) ? payload.jobs : []);
      setAuditLog(Array.isArray(payload?.audit) ? payload.audit : []);
    } catch (error) {
      enqueueToast?.(error?.message || "Falha ao carregar status dos jobs.");
    } finally {
      setLoadingRealtime(false);
    }
  }, [enqueueToast]);

  useEffect(() => {
    void loadRealtimeData();
    const interval = window.setInterval(() => {
      void loadRealtimeData();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [loadRealtimeData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      domainFilter,
      statusFilter,
      ownerFilter,
      onlyFailed,
      timeWindow,
      viewMode,
    };
    window.sessionStorage.setItem(AUTOMACOES_UI_STATE_KEY, JSON.stringify(payload));
  }, [domainFilter, statusFilter, ownerFilter, onlyFailed, timeWindow, viewMode]);

  const jobsUi = useMemo(() => {
    const latestByType = new Map();
    jobs.forEach((job) => {
      const type = String(job.job_type || "");
      const ts = new Date(job.started_at || 0).getTime();
      const current = latestByType.get(type);
      const currentTs = current ? new Date(current.started_at || 0).getTime() : -1;
      if (!current || ts > currentTs) latestByType.set(type, job);
    });

    const supported = Array.isArray(workerHealth?.jobs_supported) && workerHealth.jobs_supported.length > 0
      ? workerHealth.jobs_supported
      : JOB_CATALOG_BASE.map((item) => item.job_type);

    return supported.map((jobType) => {
      const run = latestByType.get(jobType);
      const owner = JOB_CATALOG_BASE.find((entry) => entry.job_type === jobType)?.owner || "Sistema";
      if (!run) {
        return {
          id: `placeholder-${jobType}`,
          job_type: jobType,
          name: JOB_TYPE_LABELS[jobType] || jobType,
          domain: JOB_TYPE_DOMAINS[jobType] || "Operação",
          owner,
          status: "sem_execucao",
          statusLabel: prettyStatus("sem_execucao"),
          lastRun: "-",
          duration: "-",
          nextRun: "Sob demanda",
          retries: "0/0",
          errorRate: 0,
          error_count: 0,
          processed: 0,
        };
      }
      const status = String(run.status || "").toLowerCase();
      return {
        ...run,
        id: run.job_id,
        name: JOB_TYPE_LABELS[jobType] || jobType,
        domain: JOB_TYPE_DOMAINS[jobType] || "Operação",
        owner,
        status,
        statusLabel: prettyStatus(status),
        lastRun: formatTime(run.started_at),
        duration: formatDuration(run.started_at, run.finished_at),
        nextRun: ["queued", "running"].includes(status) ? "Em execução/fila" : "Sob demanda",
        retries: `${Number(run.error_count || 0)}/${Math.max(1, Number(run.processed || 0))}`,
        errorRate:
          Number(run.processed || 0) > 0
            ? (Number(run.error_count || 0) / Number(run.processed || 1)) * 100
            : 0,
      };
    });
  }, [jobs, workerHealth?.jobs_supported]);

  const incidents = useMemo(
    () =>
      jobsUi
        .filter((job) => job.status === "failed" || Number(job.error_count || 0) > 0)
        .slice(0, 8)
        .map((job) => ({
          id: `inc-${job.id}`,
          severity: job.status === "failed" ? "alta" : "media",
          title: job.status === "failed" ? "Execução com falha" : "Execução com erros",
          job: job.name,
          when: job.lastRun,
          message: `${job.error_count || 0} erros de ${job.processed || 0} processados.`,
        })),
    [jobsUi],
  );

  const domains = useMemo(() => ["Todos", ...Array.from(new Set(jobsUi.map((job) => job.domain)))], [jobsUi]);
  const owners = useMemo(() => ["Todos", ...Array.from(new Set(jobsUi.map((job) => job.owner)))], [jobsUi]);

  const filteredJobs = useMemo(
    () =>
      jobsUi.filter((job) => {
        if (domainFilter !== "Todos" && job.domain !== domainFilter) return false;
        if (statusFilter !== "Todos" && job.status !== statusFilter) return false;
        if (ownerFilter !== "Todos" && job.owner !== ownerFilter) return false;
        if (onlyFailed && job.status !== "failed") return false;
        return true;
      }),
    [domainFilter, jobsUi, onlyFailed, ownerFilter, statusFilter],
  );

  const activeBadges = useMemo(() => {
    const badges = [];
    if (domainFilter !== "Todos") badges.push({ key: "domain", label: `Domínio: ${domainFilter}`, onClear: () => setDomainFilter("Todos") });
    if (statusFilter !== "Todos") badges.push({ key: "status", label: `Status: ${prettyStatus(statusFilter)}`, onClear: () => setStatusFilter("Todos") });
    if (ownerFilter !== "Todos") badges.push({ key: "owner", label: `Owner: ${ownerFilter}`, onClear: () => setOwnerFilter("Todos") });
    if (onlyFailed) badges.push({ key: "failed", label: "Com falha", onClear: () => setOnlyFailed(false) });
    if (timeWindow !== "24h") badges.push({ key: "window", label: `Janela: ${timeWindow}`, onClear: () => setTimeWindow("24h") });
    if (viewMode !== "operacao") badges.push({ key: "mode", label: "Visão: Configuração", onClear: () => setViewMode("operacao") });
    return badges;
  }, [domainFilter, onlyFailed, ownerFilter, statusFilter, timeWindow, viewMode]);

  const stats = useMemo(() => {
    const total = filteredJobs.length;
    const running = filteredJobs.filter((job) => job.status === "running").length;
    const failed = filteredJobs.filter((job) => job.status === "failed").length;
    const avgExec =
      filteredJobs.length > 0
        ? `${Math.max(1, Math.round(filteredJobs.reduce((acc, job) => acc + Number(String(job.duration || "").slice(0, 2) || 0), 0) / filteredJobs.length))}m`
        : "0m";
    const healthActive = Number(workerHealth?.active_jobs || running);
    return {
      running: healthActive,
      failed,
      total,
      avgExec,
      criticalNext: failed > 0 ? "Com falhas recentes" : "Sem criticidade",
    };
  }, [filteredJobs, workerHealth?.active_jobs]);

  const triggerAction = (message) => enqueueToast?.(message);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {SUBNAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange?.(item.key)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {activeBadges.map((badge) => (
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
        {activeBadges.length === 0 ? (
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
            Sem filtros adicionais ativos
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Kpi title="Jobs ativos" value={stats.running} icon={<Bot className="h-4 w-4" />} tone="blue" />
        <Kpi title="Falhas hoje" value={stats.failed} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <Kpi title="Execuções (janela)" value={stats.total} icon={<Play className="h-4 w-4" />} tone="green" />
        <Kpi title="Tempo médio" value={stats.avgExec} icon={<Clock3 className="h-4 w-4" />} tone="amber" />
        <Kpi title="Próxima crítica" value={stats.criticalNext} icon={<Wrench className="h-4 w-4" />} tone="slate" compact />
      </div>

      <Card className="border-subtle bg-card">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <select value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2 text-sm">
            {domains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2 text-sm">
            {["Todos", "queued", "running", "completed", "failed", "cancelled", "sem_execucao"].map((item) => <option key={item} value={item}>{item === "Todos" ? item : prettyStatus(item)}</option>)}
          </select>
          <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2 text-sm">
            {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
          </select>
          <select value={timeWindow} onChange={(event) => setTimeWindow(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2 text-sm">
            {["24h", "7d", "30d"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <Button type="button" size="sm" variant={onlyFailed ? "default" : "outline"} className={onlyFailed ? "bg-slate-900 text-white hover:bg-slate-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"} onClick={() => setOnlyFailed((value) => !value)}>
            Com falha
          </Button>
          <div className="ml-auto inline-flex items-center rounded-md border border-slate-300 bg-slate-50 p-1">
            <button type="button" onClick={() => setViewMode("operacao")} className={`rounded-md px-2 py-1 text-xs font-medium transition ${viewMode === "operacao" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}>Operação</button>
            <button type="button" onClick={() => setViewMode("configuracao")} className={`rounded-md px-2 py-1 text-xs font-medium transition ${viewMode === "configuracao" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}>Configuração</button>
          </div>
          <Button type="button" size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={() => triggerAction("Novo Job: fluxo de criacao em breve.")}>+ Novo Job</Button>
          <Button type="button" size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5" onClick={() => triggerAction("Diagnostico iniciado com sucesso.")}><Zap className="h-3.5 w-3.5" />Executar diagnóstico</Button>
          <Button type="button" size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5" onClick={() => void loadRealtimeData()}><RefreshCw className={`h-3.5 w-3.5 ${loadingRealtime ? "animate-spin" : ""}`} />{loadingRealtime ? "Atualizando..." : "Atualizar agora"}</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Card className="border-subtle bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fila e Saude</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última execução</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Próxima execução</TableHead>
                  <TableHead>Retry</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div className="font-medium text-slate-800">{job.name}</div>
                      <div className="text-xs text-slate-500">{job.domain} · {job.owner}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${jobStatusClass(job.status)}`}>{job.statusLabel}</span>
                    </TableCell>
                    <TableCell>{job.lastRun}</TableCell>
                    <TableCell>{job.duration}</TableCell>
                    <TableCell>{job.nextRun}</TableCell>
                    <TableCell>{job.retries}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button type="button" size="sm" variant="outline" className="h-7 border-slate-300 bg-white px-2 text-xs" onClick={() => triggerAction(`Executando ${job.name}...`)}>Executar</Button>
                        <Button type="button" size="sm" variant="outline" className="h-7 border-slate-300 bg-white px-2 text-xs" onClick={() => triggerAction(`Logs de ${job.name}.`)}>Logs</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500">Nenhum job correspondente aos filtros.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-subtle bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Alertas e Incidentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {incidents.length === 0 ? <p className="text-sm text-slate-500">Sem incidentes no momento.</p> : null}
            {incidents.map((incident) => (
              <div key={incident.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${sevClass(incident.severity)}`}>{incident.severity}</span>
                  <span className="text-xs text-slate-500">{incident.when}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-800">{incident.title}</p>
                <p className="text-xs text-slate-600">{incident.job}</p>
                <p className="mt-1 text-xs text-slate-500">{incident.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-subtle bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Catálogo de Automações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredJobs.map((job) => (
              <div key={`catalog-${job.id}`} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{job.name}</p>
                    <p className="text-xs text-slate-500">{job.domain} · Owner: {job.owner}</p>
                  </div>
                  <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${jobStatusClass(job.status)}`}>{job.statusLabel}</span>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                  <span>Cron: {job.status === "queued" ? "0 * * * *" : "manual"}</span>
                  <span>Timeout: 10m</span>
                  <span>Concorrencia: 1</span>
                  <span>Erro: {Number(job.errorRate || 0).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-subtle bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Auditoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {auditLog.length === 0 ? <p className="text-sm text-slate-500">Sem eventos de auditoria para jobs.</p> : null}
            {auditLog.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">{formatTime(entry.when)} · {entry.event_type || "job.event"}</p>
                <p className="text-sm font-medium text-slate-800">{entry.title || "Evento de job"}</p>
                <p className="text-xs text-slate-600">{entry.entity_type || "job"} {entry.entity_id ? `· ${entry.entity_id}` : ""}</p>
                <p className="text-xs text-slate-500">{entry.message || "Sem detalhes."}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ title, value, icon, tone = "blue", compact = false }) {
  const toneClass =
    tone === "red"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "green"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : tone === "slate"
            ? "border-slate-200 bg-slate-100 text-slate-700"
            : "border-blue-200 bg-blue-50 text-blue-700";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className={`mt-2 ${compact ? "text-sm" : "text-2xl"} font-semibold leading-tight text-slate-900`}>{value}</p>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${toneClass}`}>{icon}</span>
      </div>
    </div>
  );
}
