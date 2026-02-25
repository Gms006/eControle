// @ts-nocheck
import { useMemo, useState } from "react";
import { AlertTriangle, KeyRound, ShieldCheck, ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import InlineBadge from "@/components/InlineBadge";
import StatusBadge from "@/components/StatusBadge";
import CopyableIdentifier from "@/components/CopyableIdentifier";
import StatCard from "@/components/common/StatCard";
import { categorizeCertificadoSituacao, isCertificadoSituacaoAlert } from "@/lib/certificados";
import { cn } from "@/lib/utils";

type CertificadosScreenProps = {
  certificados: any[];
  modoFoco: boolean;
  matchesMunicipioFilter: (item: any) => boolean;
  matchesQuery: (values: any[], fieldMap?: Record<string, any[]>) => boolean;
  handleCopy: (value?: string, message?: string) => Promise<void> | void;
};

type ViewMode = "cards" | "table";

export default function CertificadosScreen({
  certificados,
  modoFoco,
  matchesMunicipioFilter,
  matchesQuery,
  handleCopy,
}: CertificadosScreenProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const lista = useMemo(() => (Array.isArray(certificados) ? certificados : []), [certificados]);

  const certificadosFiltrados = useMemo(() => {
    const filtered = lista.filter((item) => {
      if (!matchesMunicipioFilter(item)) return false;
      return matchesQuery(
        [
          item?.titular,
          item?.situacao,
          item?.validoDe,
          item?.validoAte,
          item?.senha,
          item?.empresa,
          item?.cnpj,
          item?.cpf,
          item?.municipio,
        ],
        {
          nome: [item?.titular, item?.empresa],
          cnpj: [item?.cnpj, item?.titular],
        },
      );
    });

    return modoFoco ? filtered.filter((item) => isCertificadoSituacaoAlert(item?.situacao)) : filtered;
  }, [lista, matchesMunicipioFilter, matchesQuery, modoFoco]);

  const stats = useMemo(() => {
    const base = {
      total: certificadosFiltrados.length,
      validos: 0,
      alertas: 0,
      vencidos: 0,
      comSenha: 0,
    };
    for (const item of certificadosFiltrados) {
      const categoria = categorizeCertificadoSituacao(item?.situacao);
      if (categoria === "VÁLIDO") base.validos += 1;
      if (categoria === "VENCIDO") base.vencidos += 1;
      if (isCertificadoSituacaoAlert(item?.situacao)) base.alertas += 1;
      if (String(item?.senha || "").trim()) base.comSenha += 1;
    }
    return base;
  }, [certificadosFiltrados]);

  const ordered = useMemo(
    () =>
      [...certificadosFiltrados].sort((a, b) => {
        const da = Number.isFinite(a?.diasRestantes) ? a.diasRestantes : Number.POSITIVE_INFINITY;
        const db = Number.isFinite(b?.diasRestantes) ? b.diasRestantes : Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return String(a?.titular || "").localeCompare(String(b?.titular || ""), "pt-BR", {
          sensitivity: "base",
        });
      }),
    [certificadosFiltrados],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Certificados listados"
          value={stats.total}
          icon={<ShieldCheck className="h-5 w-5" />}
          accentClassName="bg-blue-500"
        />
        <StatCard
          label="Válidos"
          value={stats.validos}
          icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />}
          accentClassName="bg-emerald-500"
        />
        <StatCard
          label="Em alerta"
          value={stats.alertas}
          icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
          accentClassName="bg-amber-500"
        />
        <StatCard
          label="Vencidos"
          value={stats.vencidos}
          icon={<ShieldX className="h-5 w-5 text-rose-600" />}
          accentClassName="bg-rose-500"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <InlineBadge variant="outline" className="bg-white">
          {modoFoco ? "Modo foco ativo (somente alertas)" : "Todos os certificados"}
        </InlineBadge>
        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <Button
            size="sm"
            variant={viewMode === "cards" ? "default" : "ghost"}
            onClick={() => setViewMode("cards")}
            className="h-8"
          >
            Cards
          </Button>
          <Button
            size="sm"
            variant={viewMode === "table" ? "default" : "ghost"}
            onClick={() => setViewMode("table")}
            className="h-8"
          >
            Tabela
          </Button>
        </div>
      </div>

      {ordered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-slate-500">
            Nenhum certificado encontrado com os filtros atuais.
          </CardContent>
        </Card>
      ) : viewMode === "cards" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {ordered.map((cert, index) => (
            <CertificadoCard
              key={cert?.id ?? `${cert?.titular}-${cert?.validoAte}-${index}`}
              cert={cert}
              handleCopy={handleCopy}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Certificados (dados reais)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[520px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-50">
                  <TableRow>
                    <TableHead>Titular</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Credencial</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordered.map((cert, index) => (
                    <TableRow key={cert?.id ?? `${cert?.titular}-${index}`}>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{cert?.titular || "—"}</div>
                          <div className="text-xs text-slate-500">
                            {cert?.empresa || cert?.municipio || "Sem vínculo informado"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusBadge status={cert?.situacao || "—"} />
                      </TableCell>
                      <TableCell className="align-top text-xs text-slate-700">
                        <div>De: {cert?.validoDe || "—"}</div>
                        <div>Até: {cert?.validoAte || "—"}</div>
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        <span
                          className={cn(
                            "font-semibold",
                            Number(cert?.diasRestantes) < 0
                              ? "text-rose-700"
                              : Number(cert?.diasRestantes) <= 7
                                ? "text-amber-700"
                                : "text-slate-700",
                          )}
                        >
                          {Number.isFinite(cert?.diasRestantes) ? cert.diasRestantes : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        {cert?.senha ? (
                          <CopyableIdentifier
                            label="Senha"
                            value={cert.senha}
                            onCopy={handleCopy}
                            isPassword
                          />
                        ) : (
                          <span className="text-xs text-slate-400">Sem senha</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CertificadoCard({ cert, handleCopy }: { cert: any; handleCopy: CertificadosScreenProps["handleCopy"] }) {
  const dias = Number.isFinite(cert?.diasRestantes) ? Number(cert.diasRestantes) : null;
  const isAlert = isCertificadoSituacaoAlert(cert?.situacao);

  return (
    <Card
      className={cn(
        "border-slate-200/80 bg-white shadow-sm",
        isAlert && "border-amber-200/80 bg-amber-50/20",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{cert?.titular || "Sem titular"}</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              {cert?.empresa || cert?.municipio || "Cadastro sem vínculo de empresa/município"}
            </p>
          </div>
          <StatusBadge status={cert?.situacao || "—"} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <InfoBox label="Válido de" value={cert?.validoDe || "—"} />
          <InfoBox label="Válido até" value={cert?.validoAte || "—"} />
          <InfoBox
            label="Dias restantes"
            value={
              dias === null
                ? "—"
                : dias < 0
                  ? `${Math.abs(dias)} vencido`
                  : dias === 0
                    ? "vence hoje"
                    : `${dias} dias`
            }
            tone={dias === null ? "neutral" : dias < 0 ? "danger" : dias <= 7 ? "warn" : "ok"}
          />
          <InfoBox label="Categoria" value={categorizeCertificadoSituacao(cert?.situacao)} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cert?.senha ? (
            <CopyableIdentifier label="Senha" value={cert.senha} onCopy={handleCopy} isPassword />
          ) : (
            <InlineBadge variant="outline" className="bg-white">
              Sem senha registrada
            </InlineBadge>
          )}
          {cert?.cnpj ? <CopyableIdentifier label="CNPJ" value={cert.cnpj} onCopy={handleCopy} /> : null}
          {cert?.cpf ? <CopyableIdentifier label="CPF" value={cert.cpf} onCopy={handleCopy} /> : null}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <KeyRound className="h-3.5 w-3.5" />
          Fonte: `/api/v1/certificados` (payload normalizado em `src/lib/api.js`)
        </div>
      </CardContent>
    </Card>
  );
}

function InfoBox({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
}) {
  const toneMap = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
  } as const;

  return (
    <div className={cn("rounded-xl border px-3 py-2", toneMap[tone])}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
