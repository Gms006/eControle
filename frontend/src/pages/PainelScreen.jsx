import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Chip } from "@/components/Chip";
import StatusBadge from "@/components/StatusBadge";
import KPI from "@/components/KPI";
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  LineChart as LineChartIcon,
  ListTodo,
  MapPin,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { normalizeTextLower, parsePtDate, removeDiacritics } from "@/lib/text";
import { DEFAULT_CERTIFICADO_SITUACAO, isCertificadoSituacaoAlert } from "@/lib/certificados";
import { getStatusKey, hasRelevantStatus, isAlertStatus, isProcessStatusInactive } from "@/lib/status";
import { listarTendenciaAlertas } from "@/services/alertas";
import { getProcessUrgency } from "@/lib/processUrgency";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_VISIBLE = 8;

const parseDateToLocalDay = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value === "string") {
    const ptDate = parsePtDate(value);
    if (ptDate instanceof Date && !Number.isNaN(ptDate.getTime())) {
      return ptDate;
    }
    const isoMatch = value.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }
  return null;
};

const toDayDiff = (value, start) => {
  const target = parseDateToLocalDay(value);
  if (!(target instanceof Date) || Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - start.getTime()) / MS_PER_DAY);
};

const formatDateBr = (value) => {
  const date = parseDateToLocalDay(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
};

const buildRelativeLabel = (days) => {
  if (days === null || days === undefined) return "Prazo não informado";
  if (days < 0) return `Vencido há ${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "Vence hoje";
  return `Vence em ${days} dia${days === 1 ? "" : "s"}`;
};

const normalizeKey = (value) =>
  removeDiacritics(normalizeTextLower(value))
    .replace(/\s+/g, "_")
    .trim();

const resolveCompanyId = (item) => {
  const raw = item?.empresa_id ?? item?.empresaId ?? item?.company_id ?? item?.companyId ?? item?.id;
  if (raw === null || raw === undefined) return undefined;
  const normalized = String(raw).trim();
  return normalized || undefined;
};

const resolveCnpjKey = (value) => String(value ?? "").replace(/\D/g, "").trim() || undefined;

const QueueList = ({ items, visible, onShowMore, onOpen, emptyMessage, dateLabel }) => (
  <div className="space-y-2">
    {items.length === 0 && (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
        {emptyMessage}
      </div>
    )}
    {items.slice(0, visible).map((item) => (
      <div key={item.key} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{item.empresa}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3 w-3" /> {item.municipio || "Município não informado"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {dateLabel}: {formatDateBr(item.data)}
            </p>
          </div>
          <div className="shrink-0 space-y-1 text-right">
            <StatusBadge status={item.status || "Sem status"} />
            <p className="text-xs text-slate-500">{item.relativo}</p>
            <Button size="sm" variant="outline" onClick={() => onOpen(item)}>
              Abrir
            </Button>
          </div>
        </div>
      </div>
    ))}
    {items.length > visible && (
      <Button size="sm" variant="secondary" onClick={onShowMore}>
        Ver mais ({items.length - visible})
      </Button>
    )}
  </div>
);

export default function PainelScreen(props) {
  const {
    query,
    municipio,
    soAlertas,
    kpis,
    empresas,
    licencas,
    taxas,
    certificados,
    filteredLicencas,
    processosNormalizados,
    filterEmpresas,
    companyHasAlert,
    licencasByEmpresa,
    extractEmpresaId,
    onOpenQueueTarget,
  } = props;

  void query;
  void municipio;
  void soAlertas;

  const [todayKey, setTodayKey] = useState(() => new Date().toDateString());
  const [alertTrendData, setAlertTrendData] = useState([]);
  const [workTab, setWorkTab] = useState("certificados");
  const [visibleCounts, setVisibleCounts] = useState({
    certificados: DEFAULT_VISIBLE,
    licencas: DEFAULT_VISIBLE,
    processos: DEFAULT_VISIBLE,
  });
  const [certificadosBucket, setCertificadosBucket] = useState("vencidos");

  useEffect(() => {
    const update = () => setTodayKey(new Date().toDateString());
    update();
    const interval = setInterval(update, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const startOfDay = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, [todayKey]);

  const licencaResumo = useMemo(() => {
    return filteredLicencas.reduce(
      (acc, lic) => {
        if (!hasRelevantStatus(lic?.status)) {
          return acc;
        }
        const statusKey = getStatusKey(lic.status);
        acc.total += 1;
        if (statusKey.includes("vencid")) acc.vencidas += 1;
        else if (statusKey.includes("vence")) acc.vencendo += 1;
        else if (statusKey.includes("dispens")) acc.dispensa += 1;
        else if (statusKey.includes("sujeit")) acc.sujeito += 1;
        else acc.ativas += 1;
        return acc;
      },
      { total: 0, ativas: 0, vencendo: 0, vencidas: 0, dispensa: 0, sujeito: 0 },
    );
  }, [filteredLicencas]);

  useEffect(() => {
    let active = true;
    listarTendenciaAlertas()
      .then((response) => {
        const items = Array.isArray(response?.items) ? response.items : Array.isArray(response) ? response : [];
        const normalized = items
          .map((item) => {
            const monthDate = parseDateToLocalDay(item?.mes);
            if (!(monthDate instanceof Date) || Number.isNaN(monthDate.getTime())) return null;
            const vencendo = Number(item?.alertas_vencendo) || 0;
            const vencidas = Number(item?.alertas_vencidas) || 0;
            const monthLabel = monthDate
              .toLocaleDateString("pt-BR", { month: "short" })
              .replace(/\./g, "")
              .toLowerCase();
            return {
              date: monthDate,
              ts: monthDate.getTime(),
              label: `${monthLabel}/${String(monthDate.getFullYear()).slice(-2)}`,
              total_alertas: vencendo + vencidas,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.ts - b.ts);
        if (active) setAlertTrendData(normalized);
      })
      .catch((error) => {
        console.error("[Painel] Falha ao carregar tendência de alertas", error);
        if (active) setAlertTrendData([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const processosAtivos = useMemo(
    () => processosNormalizados.filter((proc) => !isProcessStatusInactive(proc.status)),
    [processosNormalizados],
  );

  const selfTestResults = useMemo(
    () => [
      { label: "Empresas", pass: empresas.length > 0 },
      { label: "Licenças", pass: licencas.length > 0 },
      { label: "Taxas", pass: taxas.length > 0 },
      { label: "Processos", pass: processosAtivos.length > 0 },
    ],
    [empresas.length, licencas.length, processosAtivos.length, taxas.length],
  );

  const companyIndexes = useMemo(() => {
    const byId = new Map();
    const byCnpj = new Map();
    empresas.forEach((empresa) => {
      const id = resolveCompanyId(empresa);
      if (id) byId.set(id, empresa);
      const cnpj = resolveCnpjKey(empresa?.cnpj);
      if (cnpj) byCnpj.set(cnpj, empresa);
    });
    return { byId, byCnpj };
  }, [empresas]);

  const resolveCompany = (item) => {
    const id = resolveCompanyId(item);
    if (id && companyIndexes.byId.has(id)) return companyIndexes.byId.get(id);
    const cnpj = resolveCnpjKey(item?.cnpj ?? item?.company_cnpj);
    if (cnpj && companyIndexes.byCnpj.has(cnpj)) return companyIndexes.byCnpj.get(cnpj);
    return null;
  };

  const certificadosOperacionais = useMemo(() => {
    const list = Array.isArray(certificados) ? certificados : [];
    return list
      .map((cert, index) => {
        const company = resolveCompany(cert);
        const days = Number.isFinite(cert?.diasRestantes) ? Number(cert.diasRestantes) : toDayDiff(cert?.validoAte, startOfDay);
        const group = days === null ? "sem_data" : days < 0 ? "vencidos" : days <= 7 ? "ate7" : days <= 30 ? "ate30" : "outros";
        return {
          key: String(cert?.id ?? `${cert?.titular}-${cert?.validoAte}-${index}`),
          empresa: cert?.empresa ?? company?.empresa ?? cert?.titular ?? "Empresa não vinculada",
          municipio: cert?.municipio ?? company?.municipio ?? "",
          status: cert?.situacao ?? "Sem status",
          data: cert?.validoAte ?? cert?.valido_ate ?? null,
          dias: days,
          relativo: buildRelativeLabel(days),
          tipo: cert?.tipo ?? cert?.modelo ?? "—",
          group,
        };
      })
      .filter((item) => item.group !== "outros")
      .sort((a, b) => (a.dias ?? 9999) - (b.dias ?? 9999));
  }, [certificados, startOfDay]);

  const certificadosGroups = useMemo(
    () => ({
      vencidos: certificadosOperacionais.filter((item) => item.group === "vencidos"),
      ate7: certificadosOperacionais.filter((item) => item.group === "ate7"),
      ate30: certificadosOperacionais.filter((item) => item.group === "ate30"),
    }),
    [certificadosOperacionais],
  );

  const licencasCriticas = useMemo(() => {
    return licencas
      .map((lic, index) => {
        const statusKey = normalizeKey(getStatusKey(lic?.status));
        const days = toDayDiff(lic?.validade ?? lic?.validade_br, startOfDay);
        let group = null;
        if (!statusKey) group = "sem_status";
        else if (statusKey.includes("nao_possui")) group = "nao_possui";
        else if (statusKey.includes("vencid") || (typeof days === "number" && days < 0)) group = "vencido";
        else if (typeof days === "number" && days >= 0 && days <= 7) group = "ate7";
        if (!group) return null;
        return {
          key: String(lic?.id ?? `${lic?.empresa}-${lic?.tipo}-${index}`),
          empresa: lic?.empresa ?? lic?.company_name ?? "Empresa não vinculada",
          municipio: lic?.municipio ?? lic?.company_municipio ?? "",
          status: lic?.status ?? "Sem status",
          data: lic?.validade ?? lic?.validade_br ?? null,
          dias: days,
          relativo: buildRelativeLabel(days),
          tipo: lic?.tipo ?? "Licença",
          group,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.dias ?? 9999) - (b.dias ?? 9999));
  }, [licencas, startOfDay]);

  const licencasGroups = useMemo(
    () => ({
      vencido: licencasCriticas.filter((item) => item.group === "vencido"),
      ate7: licencasCriticas.filter((item) => item.group === "ate7"),
      nao_possui: licencasCriticas.filter((item) => item.group === "nao_possui"),
      sem_status: licencasCriticas.filter((item) => item.group === "sem_status"),
    }),
    [licencasCriticas],
  );

  const processosUrgentes = useMemo(() => {
    return processosNormalizados
      .map((proc, index) => {
        const urgency = getProcessUrgency(proc);
        if (!urgency.buckets.length) return null;
        const company = resolveCompany(proc);
        return {
          key: String(proc?.id ?? proc?.process_id ?? `${proc?.protocolo}-${index}`),
          empresa: proc?.empresa ?? company?.empresa ?? "Empresa não vinculada",
          municipio: proc?.municipio ?? company?.municipio ?? "",
          status: proc?.situacao ?? proc?.status ?? "Sem status",
          data: proc?.data_solicitacao ?? null,
          dias: urgency.daysToDue,
          relativo: buildRelativeLabel(urgency.daysToDue),
          tipo: proc?.tipo ?? proc?.process_type ?? "Processo",
          buckets: urgency.buckets,
          score: urgency.score,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
  }, [processosNormalizados]);

  const processosGroups = useMemo(
    () => ({
      awaiting_payment: processosUrgentes.filter((item) => item.buckets.includes("awaiting_payment")),
      in_analysis: processosUrgentes.filter((item) => item.buckets.includes("in_analysis")),
      incomplete: processosUrgentes.filter((item) => item.buckets.includes("incomplete")),
      due7: processosUrgentes.filter((item) => item.buckets.includes("due7")),
    }),
    [processosUrgentes],
  );

  const workQueues = useMemo(() => {
    const certQueue = [...certificadosGroups.vencidos, ...certificadosGroups.ate7, ...certificadosGroups.ate30].slice(0, 40);
    const licQueue = [...licencasGroups.vencido, ...licencasGroups.ate7, ...licencasGroups.nao_possui, ...licencasGroups.sem_status].slice(0, 40);
    const procQueue = [...processosGroups.awaiting_payment, ...processosGroups.in_analysis, ...processosGroups.incomplete, ...processosGroups.due7].slice(0, 40);
    return { certQueue, licQueue, procQueue };
  }, [certificadosGroups, licencasGroups, processosGroups]);

  const empresasComPendencias = useMemo(
    () => filterEmpresas(empresas.filter((empresa) => companyHasAlert(empresa))).slice(0, 8),
    [companyHasAlert, empresas, filterEmpresas],
  );

  const abrirCertificados = (group) =>
    onOpenQueueTarget?.({
      tab: "certificados",
      preset: { group },
    });

  const abrirLicencas = (group) =>
    onOpenQueueTarget?.({
      tab: "licencas",
      preset: { group },
    });

  const abrirProcessos = (bucket) =>
    onOpenQueueTarget?.({
      tab: "processos",
      preset: { bucket },
    });

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KPI
          title="Empresas monitoradas"
          value={kpis.total_empresas || empresas.length}
          icon={<Building2 className="h-5 w-5" />}
          accent="bg-white/80"
        />
        <KPI
          title="Sem certificado digital"
          value={kpis.sem_certificado || 0}
          icon={<ShieldAlert className="h-5 w-5 text-amber-600" />}
          accent="bg-amber-100/80"
        />
        <KPI
          title="Licenças vencidas"
          value={kpis.licencas_vencidas || licencaResumo.vencidas}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          accent="bg-red-100/70"
        />
        <KPI
          title="TPI pendentes"
          value={kpis.tpi_pendente || 0}
          icon={<Bell className="h-5 w-5 text-sky-600" />}
          accent="bg-sky-100/70"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <LineChartIcon className="h-4 w-4" /> Tendência de alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={alertTrendData.length > 0 ? "h-56 md:h-64" : "h-24"}>
              {alertTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={alertTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="ts"
                      type="number"
                      scale="time"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(ts) => {
                        const d = new Date(ts);
                        const month = d
                          .toLocaleDateString("pt-BR", { month: "short" })
                          .replace(/\./g, "")
                          .toLowerCase();
                        return `${month}/${String(d.getFullYear()).slice(-2)}`;
                      }}
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="total_alertas"
                      stroke="#f97316"
                      strokeWidth={2}
                      fill="#fb923c"
                      fillOpacity={0.2}
                      name="Alertas de vencimento"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
                  Tendência sem dados no período atual.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-4 w-4" /> Auto-teste do painel
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-xs">
            {selfTestResults.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                <span className="font-medium text-slate-700">{item.label}</span>
                {item.pass ? (
                  <Chip variant="success">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> OK
                  </Chip>
                ) : (
                  <Chip variant="warning">Verificar</Chip>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ListTodo className="h-4 w-4" /> Minhas prioridades hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={workTab} onValueChange={setWorkTab}>
            <TabsList className="grid-cols-3 md:grid-cols-3">
              <TabsTrigger value="certificados">Certificados ({workQueues.certQueue.length})</TabsTrigger>
              <TabsTrigger value="licencas">Licenças ({workQueues.licQueue.length})</TabsTrigger>
              <TabsTrigger value="processos">Processos ({workQueues.procQueue.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="certificados" className="mt-3">
              <QueueList
                items={workQueues.certQueue}
                visible={visibleCounts.certificados}
                onShowMore={() =>
                  setVisibleCounts((current) => ({ ...current, certificados: current.certificados + DEFAULT_VISIBLE }))
                }
                onOpen={(item) => abrirCertificados(item.group === "vencidos" ? "expired" : item.group === "ate7" ? "due7" : "due30")}
                dateLabel="Validade"
                emptyMessage="Sem certificados vencidos ou vencendo para priorizar hoje."
              />
            </TabsContent>

            <TabsContent value="licencas" className="mt-3">
              <QueueList
                items={workQueues.licQueue}
                visible={visibleCounts.licencas}
                onShowMore={() =>
                  setVisibleCounts((current) => ({ ...current, licencas: current.licencas + DEFAULT_VISIBLE }))
                }
                onOpen={(item) => abrirLicencas(item.group)}
                dateLabel="Vencimento"
                emptyMessage="Sem licenças críticas no momento."
              />
            </TabsContent>

            <TabsContent value="processos" className="mt-3">
              <QueueList
                items={workQueues.procQueue}
                visible={visibleCounts.processos}
                onShowMore={() =>
                  setVisibleCounts((current) => ({ ...current, processos: current.processos + DEFAULT_VISIBLE }))
                }
                onOpen={(item) => abrirProcessos(item.buckets?.[0] || "all")}
                dateLabel="Solicitação"
                emptyMessage="Sem processos urgentes/em andamento para priorizar hoje."
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Certificados vencendo/vencidos</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={certificadosBucket === "vencidos" ? "default" : "secondary"}
                onClick={() => setCertificadosBucket("vencidos")}
              >
                Vencidos ({certificadosGroups.vencidos.length})
              </Button>
              <Button
                size="sm"
                variant={certificadosBucket === "ate7" ? "default" : "secondary"}
                onClick={() => setCertificadosBucket("ate7")}
              >
                Vencendo &lt;=7 ({certificadosGroups.ate7.length})
              </Button>
              <Button
                size="sm"
                variant={certificadosBucket === "ate30" ? "default" : "secondary"}
                onClick={() => setCertificadosBucket("ate30")}
              >
                Vencendo &lt;=30 ({certificadosGroups.ate30.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-72">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-50">
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Dias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(certificadosGroups[certificadosBucket] || []).map((item) => (
                    <TableRow key={`cert-${item.key}`}>
                      <TableCell>{item.empresa}</TableCell>
                      <TableCell>{item.tipo}</TableCell>
                      <TableCell>{formatDateBr(item.data)}</TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="text-xs">{item.relativo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(certificadosGroups[certificadosBucket] || []).length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-slate-500">
                  Nenhum certificado neste recorte. Se existir pendência sem data de validade, revisar cadastro do certificado.
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Licenças críticas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: "vencido", title: "Vencidas", list: licencasGroups.vencido },
              { key: "ate7", title: "Vencendo <=7 dias", list: licencasGroups.ate7 },
              { key: "nao_possui", title: "Não possui (obrigatório)", list: licencasGroups.nao_possui },
              { key: "sem_status", title: "Sem status (backlog)", list: licencasGroups.sem_status },
            ].map((group) => (
              <div key={group.key} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">{group.title}</p>
                  <Chip variant={group.list.length > 0 ? "warning" : "neutral"}>{group.list.length}</Chip>
                </div>
                {group.list.length === 0 ? (
                  <p className="text-xs text-slate-500">Sem itens neste grupo.</p>
                ) : (
                  <div className="space-y-2">
                    {group.list.slice(0, 4).map((item) => (
                      <div key={`lic-${item.key}`} className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">{item.empresa}</p>
                          <p className="truncate text-slate-500">
                            {item.tipo} • {formatDateBr(item.data)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <StatusBadge status={item.status} />
                          <Button size="sm" variant="outline" className="mt-1 h-7" onClick={() => abrirLicencas(group.key)}>
                            Abrir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Processos urgentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: "awaiting_payment", title: "Aguardando pagamento", list: processosGroups.awaiting_payment },
              { key: "in_analysis", title: "Em análise", list: processosGroups.in_analysis },
              { key: "incomplete", title: "Sem protocolo / dados incompletos", list: processosGroups.incomplete },
              { key: "due7", title: "Próximos do prazo", list: processosGroups.due7 },
            ].map((group) => (
              <div key={group.key} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">{group.title}</p>
                  <Chip variant={group.list.length > 0 ? "warning" : "neutral"}>{group.list.length}</Chip>
                </div>
                {group.list.length === 0 ? (
                  <p className="text-xs text-slate-500">Sem itens nesta fila.</p>
                ) : (
                  <div className="space-y-2">
                    {group.list.slice(0, 4).map((item) => (
                      <div key={`proc-${item.key}`} className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">{item.empresa}</p>
                          <p className="truncate text-slate-500">
                            {item.tipo} • solicitação {formatDateBr(item.data)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <StatusBadge status={item.status} />
                          <Button size="sm" variant="outline" className="mt-1 h-7" onClick={() => abrirProcessos(group.key)}>
                            Abrir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Empresas com pendências</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-52">
            <ul className="divide-y divide-slate-200">
              {empresasComPendencias.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-slate-500">Nenhuma pendência identificada no momento.</li>
              )}
              {empresasComPendencias.map((empresa) => {
                const empresaId = extractEmpresaId(empresa);
                const licencasPendentes = empresaId !== undefined ? licencasByEmpresa.get(empresaId) || [] : [];
                const situacaoCertificado = empresa.certificado || DEFAULT_CERTIFICADO_SITUACAO;
                const mostrarCertificado = isCertificadoSituacaoAlert(situacaoCertificado);
                return (
                  <li key={empresa.id} className="px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-800">{empresa.empresa}</p>
                        <p className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3 w-3" /> {empresa.municipio}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {normalizeTextLower(empresa.debito) === "sim" && <StatusBadge status="Não pago" />}
                        {mostrarCertificado && <StatusBadge status={situacaoCertificado} />}
                        {licencasPendentes
                          .filter((lic) => isAlertStatus(lic.status))
                          .slice(0, 2)
                          .map((lic) => (
                            <StatusBadge key={`${empresa.id}-${lic.tipo}`} status={lic.status} />
                          ))}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
