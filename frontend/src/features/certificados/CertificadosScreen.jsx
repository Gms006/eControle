import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InlineBadge from "@/components/InlineBadge";
import CertificadoCard from "@/features/certificados/CertificadoCard";
import AgendamentosTable from "@/features/certificados/AgendamentosTable";
import { categorizeCertificadoSituacao } from "@/lib/certificados";
import { normalizeTextLower } from "@/lib/text";
import { cn } from "@/lib/utils";

const DATE_REGEX = /(\d{2}\/\d{2}\/\d{4})/;

const SORT_FIELDS = [
  { value: "vencimento", label: "Vencimento" },
  { value: "nome", label: "Nome" },
];

const extractDate = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const match = value.match(DATE_REGEX);
  if (match) {
    return match[1];
  }
  return value.trim();
};

const SITUACAO_OPTIONS = ["Todos", "Válido", "Vencendo em breve", "Vencido"];

const getDateTimestamp = (value) => {
  const date = extractDate(value);
  if (!date) return null;

  if (DATE_REGEX.test(date)) {
    const [day, month, year] = date.split("/").map((item) => Number.parseInt(item, 10));
    const timestamp = new Date(year, month - 1, day).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? null : parsed;
};

const compareByDate = (a, b, direction) => {
  const timeA = getDateTimestamp(a?.validoAte ?? "");
  const timeB = getDateTimestamp(b?.validoAte ?? "");
  if (timeA === null && timeB === null) return 0;
  if (timeA === null) return 1;
  if (timeB === null) return -1;
  return direction === "desc" ? timeB - timeA : timeA - timeB;
};

const compareByName = (a, b, direction) => {
  const nameA = normalizeTextLower(a?.titular ?? "").trim();
  const nameB = normalizeTextLower(b?.titular ?? "").trim();
  if (!nameA && !nameB) return 0;
  if (!nameA) return 1;
  if (!nameB) return -1;
  const result = nameA.localeCompare(nameB);
  return direction === "desc" ? result * -1 : result;
};

export default function CertificadosScreen({ certificados, agendamentos, soAlertas }) {
  const [subTab, setSubTab] = useState("certificados");
  const [search, setSearch] = useState("");
  const [situacao, setSituacao] = useState("Todos");
  const [sortField, setSortField] = useState("vencimento");
  const [sortDir, setSortDir] = useState("asc");

  const handleSortClick = (field) => {
    if (field === sortField) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDir("asc");
  };

  const certificadosLista = useMemo(
    () => (Array.isArray(certificados) ? certificados : []),
    [certificados],
  );

  const agendamentosLista = useMemo(
    () => (Array.isArray(agendamentos) ? agendamentos : []),
    [agendamentos],
  );

  const filteredCertificados = useMemo(() => {
    const query = normalizeTextLower(search).trim();
    return certificadosLista.filter((item) => {
      const titular = normalizeTextLower(item?.titular ?? "");
      const categoria = categorizeCertificadoSituacao(item?.situacao ?? "");
      if (situacao !== "Todos" && categoria !== situacao) {
        return false;
      }
      if (soAlertas && !["Vencido", "Vencendo em breve"].includes(categoria)) {
        return false;
      }
      if (query === "") {
        return true;
      }
      return titular.includes(query);
    });
  }, [certificadosLista, search, situacao, soAlertas]);

  const orderedCertificados = useMemo(() => {
    const comparator = (a, b) => {
      if (sortField === "nome") {
        return compareByName(a, b, sortDir);
      }
      return compareByDate(a, b, sortDir);
    };
    return [...filteredCertificados].sort(comparator);
  }, [filteredCertificados, sortDir, sortField]);

  return (
    <Tabs value={subTab} onValueChange={setSubTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="certificados">Certificados</TabsTrigger>
        <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
      </TabsList>
      <TabsContent value="certificados" className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Buscar titular / CPF/CNPJ"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full md:w-72"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Filtrar por Situação</span>
            <Select value={situacao} onValueChange={setSituacao}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                {SITUACAO_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Ordenar por</span>
            {SORT_FIELDS.map((option) => {
              const isActive = sortField === option.value;
              const directionSymbol = isActive ? (sortDir === "asc" ? "↑" : "↓") : null;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSortClick(option.value)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    isActive && "border-primary/60 bg-primary/5 text-primary font-semibold"
                  )}
                >
                  <span>{option.label}</span>
                  {directionSymbol && <span className="text-xs">{directionSymbol}</span>}
                </button>
              );
            })}
          </div>
          {soAlertas && (
            <InlineBadge variant="outline" className="uppercase tracking-wide">
              Modo foco ativo
            </InlineBadge>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orderedCertificados.map((certificado) => (
            <CertificadoCard key={certificado.id} certificado={certificado} />
          ))}
          {orderedCertificados.length === 0 && (
            <div className="text-sm text-slate-500 py-12 text-center border border-dashed border-slate-200 rounded-xl">
              Nenhum certificado encontrado.
            </div>
          )}
        </div>
      </TabsContent>
      <TabsContent value="agendamentos">
        <AgendamentosTable agendamentos={agendamentosLista} />
      </TabsContent>
    </Tabs>
  );
}
