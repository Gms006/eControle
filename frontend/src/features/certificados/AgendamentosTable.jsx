import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { normalizeTextLower } from "@/lib/text";

const CERTIFICADO_OPTIONS = [
  "Todos",
  "Bird Trial",
  "A1 - PF",
  "A1 - PJ",
  "A3 - PF",
  "A3 - PJ",
];

const METODO_OPTIONS = ["Todos", "Presencial", "Videoconferência", "Bird ID"];

const PAGAMENTO_OPTIONS = [
  "Todos",
  "PIX",
  "PIX - Marco/Neto",
  "Dinheiro",
  "Gratuito",
];

export default function AgendamentosTable({ agendamentos }) {
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("Todos");
  const [metodoFilter, setMetodoFilter] = useState("Todos");
  const [pagamentoFilter, setPagamentoFilter] = useState("Todos");
  const [concluidos, setConcluidos] = useState({}); // TODO: persistir

  const agendamentosLista = useMemo(
    () => (Array.isArray(agendamentos) ? agendamentos : []),
    [agendamentos],
  );

  const filtered = useMemo(() => {
    const query = normalizeTextLower(search).trim();
    return agendamentosLista.filter((item) => {
      const tipo = item?.certificadoTipo ?? "";
      const metodo = item?.metodo ?? "";
      const pagamento = item?.metodoPagamento ?? "";
      const matchesTipo = tipoFilter === "Todos" || normalizeTextLower(tipo) === normalizeTextLower(tipoFilter);
      const matchesMetodo =
        metodoFilter === "Todos" || normalizeTextLower(metodo) === normalizeTextLower(metodoFilter);
      const matchesPagamento =
        pagamentoFilter === "Todos" || normalizeTextLower(pagamento) === normalizeTextLower(pagamentoFilter);
      const matchesSearch =
        query === "" ||
        normalizeTextLower(item?.cliente).includes(query) ||
        normalizeTextLower(item?.cpfCnpj).includes(query);
      return matchesTipo && matchesMetodo && matchesPagamento && matchesSearch;
    });
  }, [agendamentosLista, metodoFilter, pagamentoFilter, search, tipoFilter]);

  const handleToggle = (id) => (checked) => {
    setConcluidos((prev) => ({ ...prev, [id]: checked }));
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Agendamentos</CardTitle>
        <div className="mt-3 grid gap-2 md:grid-cols-4 text-sm">
          <Input
            placeholder="Buscar por cliente ou CPF/CNPJ"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Certificado" />
            </SelectTrigger>
            <SelectContent>
              {CERTIFICADO_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={metodoFilter} onValueChange={setMetodoFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Método" />
            </SelectTrigger>
            <SelectContent>
              {METODO_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={pagamentoFilter} onValueChange={setPagamentoFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Pagamento" />
            </SelectTrigger>
            <SelectContent>
              {PAGAMENTO_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Certificado</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Método de Pagamento</TableHead>
                <TableHead>Concluído</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const id = item?.id ?? `${item?.cliente}-${item?.cpfCnpj}`;
                const checked = Boolean(concluidos[id]);
                return (
                  <TableRow key={id}>
                    <TableCell className="font-medium">{item?.cliente || "—"}</TableCell>
                    <TableCell>{item?.cpfCnpj || "—"}</TableCell>
                    <TableCell>{item?.certificadoTipo || "—"}</TableCell>
                    <TableCell>{item?.data || "—"}</TableCell>
                    <TableCell>{item?.metodo || "—"}</TableCell>
                    <TableCell>{item?.horario || "—"}</TableCell>
                    <TableCell>{item?.metodoPagamento || "—"}</TableCell>
                    <TableCell>
                      <Switch checked={checked} onCheckedChange={handleToggle(id)} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-sm text-slate-500">
                    Nenhum agendamento encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
