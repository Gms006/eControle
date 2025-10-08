import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import InlineBadge from "@/components/InlineBadge";
import StatusBadge from "@/components/StatusBadge";
import KPI from "@/components/KPI";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  LineChart as LineChartIcon,
  MapPin,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { normalizeTextLower, parsePtDate } from "@/lib/text";
import {
  getStatusKey,
  hasRelevantStatus,
  isAlertStatus,
  isProcessStatusInactive,
} from "@/lib/status";

const MONTHS_WINDOW = 12;

export default function PainelScreen(props) {
  const {
    query,
    municipio,
    soAlertas,
    kpis,
    empresas,
    licencas,
    taxas,
    filteredLicencas,
    processosNormalizados,
    filterEmpresas,
    companyHasAlert,
    licencasByEmpresa,
    extractEmpresaId,
  } = props;

  void query;
  void municipio;
  void soAlertas;

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

  const alertTrendData = useMemo(() => {
    if (!Array.isArray(filteredLicencas)) {
      return [];
    }

    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = new Date(end.getFullYear(), end.getMonth() - (MONTHS_WINDOW - 1), 1);

    const counts = new Map();

    filteredLicencas.forEach((lic) => {
      if (!lic || !isAlertStatus(lic.status)) return;

      const statusKey = getStatusKey(lic.status);
      if (!statusKey) return;
      if (!statusKey.includes("vencid") && !statusKey.includes("vence")) return;

      let validade = parsePtDate(lic.validade);
      if (!validade && typeof lic.validade === "string") {
        const isoCandidate = new Date(lic.validade);
        if (!Number.isNaN(isoCandidate?.getTime())) {
          validade = isoCandidate;
        }
      }

      if (!(validade instanceof Date) || Number.isNaN(validade.getTime())) {
        return;
      }

      const monthDate = new Date(validade.getFullYear(), validade.getMonth(), 1);
      if (monthDate < start || monthDate > end) {
        return;
      }

      const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const data = [];
    for (
      let year = start.getFullYear(), month = start.getMonth();
      year < end.getFullYear() || (year === end.getFullYear() && month <= end.getMonth());
    ) {
      const currentDate = new Date(year, month, 1);
      const key = `${year}-${month}`;
      const total = counts.get(key) ?? 0;
      const monthLabel = currentDate
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(/\./g, "")
        .toLowerCase();
      data.push({
        date: currentDate,
        ts: currentDate.getTime(),
        label: `${monthLabel}/${String(year).slice(-2)}`,
        total_alertas: total,
      });

      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }

    return data;
  }, [filteredLicencas]);

  const processosAtivos = useMemo(() => {
    return processosNormalizados.filter((proc) => !isProcessStatusInactive(proc.status));
  }, [processosNormalizados]);

  const selfTestResults = useMemo(
    () => [
      { label: "Empresas carregadas", pass: empresas.length > 0 },
      { label: "Licenças normalizadas", pass: licencas.length > 0 },
      { label: "Taxas disponíveis", pass: taxas.length > 0 },
      { label: "Processos ativos", pass: processosAtivos.length > 0 },
    ],
    [empresas.length, licencas.length, processosAtivos.length, taxas.length],
  );

  const empresasComPendencias = useMemo(
    () => filterEmpresas(empresas.filter((empresa) => companyHasAlert(empresa))).slice(0, 8),
    [companyHasAlert, empresas, filterEmpresas],
  );

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

      <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <LineChartIcon className="h-4 w-4" /> Tendência de alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 md:h-64">
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
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={{ fontSize: 12 }}
                      labelStyle={{ color: "#0f172a", fontWeight: 600 }}
                      labelFormatter={(ts) => {
                        const d = new Date(ts);
                        const month = d
                          .toLocaleDateString("pt-BR", { month: "short" })
                          .replace(/\./g, "")
                          .toLowerCase();
                        return `${month}/${String(d.getFullYear()).slice(-2)}`;
                      }}
                    />
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
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">
                  Sem dados para o período/filtro.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Auto-teste do painel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {selfTestResults.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <span className="font-medium text-slate-700">{item.label}</span>
                {item.pass ? (
                  <InlineBadge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> OK
                  </InlineBadge>
                ) : (
                  <InlineBadge className="bg-amber-100 text-amber-700 border-amber-200">
                    <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Verificar
                  </InlineBadge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Empresas com pendências
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-60">
            <ul className="divide-y divide-slate-200">
              {empresasComPendencias.length === 0 && (
                <li className="px-4 py-6 text-sm text-slate-500 text-center">
                  Nenhuma pendência identificada no momento.
                </li>
              )}
              {empresasComPendencias.map((empresa) => {
                const empresaId = extractEmpresaId(empresa);
                const licencasPendentes =
                  empresaId !== undefined ? licencasByEmpresa.get(empresaId) || [] : [];
                return (
                  <li key={empresa.id} className="px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-800">{empresa.empresa}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {empresa.municipio}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {normalizeTextLower(empresa.debito) === "sim" && (
                          <StatusBadge status="Não pago" />
                        )}
                        {normalizeTextLower(empresa.certificado) === "não" && <StatusBadge status="NÃO" />}
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
