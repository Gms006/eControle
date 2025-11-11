import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Building2, Info, TrendingUp } from "lucide-react";

const KPI_ICONS = {
  total_empresas: Building2,
  sem_certificado: Info,
  licencas_vencidas: AlertTriangle,
  tpi_pendente: TrendingUp,
};

const getIcon = (chave) => {
  const Icon = KPI_ICONS[chave] || Info;
  return <Icon className="h-5 w-5" />;
};

export default function PainelScreen({ loading, kpiItems, kpisResumo, alertas }) {
  const items = Array.isArray(kpiItems) && kpiItems.length > 0
    ? kpiItems
    : Object.entries(kpisResumo || {}).map(([chave, valor]) => ({ chave, valor, valor_nome: chave }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Indicadores principais</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Carregando indicadores…</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">Nenhum indicador disponível.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <div key={`${item.grupo}-${item.chave}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>{item.valor_nome || item.chave}</span>
                    <span className="text-slate-400">{item.grupo}</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-slate-800">{item.valor ?? 0}</span>
                    <span className="text-slate-400">{getIcon(item.chave)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Alertas recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Carregando alertas…</div>
          ) : alertas.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">Nenhum alerta no momento.</div>
          ) : (
            <ul className="space-y-3">
              {alertas.slice(0, 5).map((alerta) => (
                <li
                  key={alerta.alerta_id}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                >
                  <div className="font-medium">{alerta.empresa}</div>
                  <div className="flex items-center justify-between text-xs text-amber-700">
                    <span>{alerta.tipo_alerta}</span>
                    <span>{alerta.dias_restantes ?? "-"} dia(s)</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
