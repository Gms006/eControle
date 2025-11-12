import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const formatNumber = (value) => {
  const number = Number(value);
  if (Number.isNaN(number)) return value ?? "-";
  return number.toLocaleString("pt-BR");
};

export default function EmpresasScreen({ loading, empresas, total }) {
  const quantidade = Array.isArray(empresas) ? empresas.length : 0;

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="flex items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">Empresas monitoradas</CardTitle>
          <span className="text-xs text-slate-500">
            Exibindo {quantidade} de {formatNumber(total ?? quantidade)}
          </span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Carregando empresas…</div>
          ) : quantidade === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">Nenhuma empresa encontrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Município</TableHead>
                    <TableHead className="text-right">Licenças</TableHead>
                    <TableHead className="text-right">Taxas</TableHead>
                    <TableHead className="text-right">Processos ativos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresas.map((empresa) => (
                    <TableRow key={empresa.empresa_id ?? empresa.id}>
                      <TableCell className="font-medium text-slate-800">{empresa.empresa}</TableCell>
                      <TableCell className="text-sm text-slate-600">{empresa.cnpj}</TableCell>
                      <TableCell className="text-sm text-slate-600">{empresa.municipio ?? "-"}</TableCell>
                      <TableCell className="text-right text-sm text-slate-700">
                        {formatNumber(empresa.total_licencas ?? 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-700">
                        {formatNumber(empresa.total_taxas ?? 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-700">
                        {formatNumber(empresa.processos_ativos ?? 0)}
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
