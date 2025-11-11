import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";

const formatDate = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("pt-BR");
};

export default function AlertasScreen({ loading, alertas }) {
  const total = Array.isArray(alertas) ? alertas.length : 0;

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Alertas de vencimento
          </CardTitle>
          <span className="text-xs text-slate-500">{total} alerta(s)</span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Carregando alertas…</div>
          ) : total === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">Nenhum alerta cadastrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead className="text-right">Dias restantes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertas.map((alerta) => (
                    <TableRow key={alerta.alerta_id}>
                      <TableCell>
                        <div className="font-medium text-slate-800">{alerta.empresa}</div>
                        <div className="text-xs text-slate-500">{alerta.cnpj}</div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{alerta.tipo_alerta}</TableCell>
                      <TableCell className="text-sm text-slate-600">{alerta.descricao}</TableCell>
                      <TableCell className="text-sm text-slate-600">{formatDate(alerta.validade)}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-amber-700">
                        {alerta.dias_restantes ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
