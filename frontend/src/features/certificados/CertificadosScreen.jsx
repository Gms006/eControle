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
import { normalizeTextLower, removeDiacritics } from "@/lib/text";

const DATE_REGEX = /(\d{2}\/\d{2}\/\d{4})/;

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

const categorizeSituacao = (situacao) => {
  const key = removeDiacritics(normalizeTextLower(situacao)).trim();
  if (!key) {
    return "Outros";
  }
  if (key.includes("vencid")) {
    return "Vencido";
  }
  if (key.includes("vencend") || key.includes("vence")) {
    return "Vencendo em breve";
  }
  if (key.includes("valido") || key.includes("vigent") || key.includes("ativo")) {
    return "Válido";
  }
  return "Outros";
};

const SITUACAO_OPTIONS = ["Todos", "Válido", "Vencendo em breve", "Vencido"];

export default function CertificadosScreen({ certificados, agendamentos, soAlertas }) {
  const [subTab, setSubTab] = useState("certificados");
  const [search, setSearch] = useState("");
  const [situacao, setSituacao] = useState("Todos");

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
      const categoria = categorizeSituacao(item?.situacao ?? "");
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
    return [...filteredCertificados].sort((a, b) => {
      const dateA = extractDate(a?.validoAte ?? "");
      const dateB = extractDate(b?.validoAte ?? "");
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      const [dayA, monthA, yearA] = dateA.split("/").map((value) => Number.parseInt(value, 10));
      const [dayB, monthB, yearB] = dateB.split("/").map((value) => Number.parseInt(value, 10));
      const timeA = new Date(yearA, monthA - 1, dayA).getTime();
      const timeB = new Date(yearB, monthB - 1, dayB).getTime();
      return timeA - timeB;
    });
  }, [filteredCertificados]);

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
