import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import InlineBadge from "@/components/InlineBadge";
import StatusBadge from "@/components/StatusBadge";
import CopyableIdentifier from "@/components/CopyableIdentifier";
import { Separator } from "@/components/ui/separator";
import {
  DIVERSOS_OPERACAO_ALL,
  DIVERSOS_OPERACAO_SEM,
  PROCESS_BASE_COLUMNS,
  PROCESS_DIVERSOS_LABEL,
  resolveProcessExtraColumns,
  getDiversosOperacaoLabel,
} from "@/lib/process";
import { PROCESS_ALL } from "@/lib/constants";
import { normalizeIdentifier, normalizeText } from "@/lib/text";
import {
  Droplets,
  Clipboard,
  ClipboardCheck,
  Filter,
  FileText,
  MapPin,
  Settings,
  Shield,
  Trees,
} from "lucide-react";
import { isProcessStatusActiveOrPending } from "@/lib/status";

const PROCESS_ICONS = {
  Diversos: <Settings className="h-4 w-4" />, // fallback genérico
  Funcionamento: <ClipboardCheck className="h-4 w-4" />,
  Bombeiros: <Shield className="h-4 w-4" />,
  Ambiental: <Trees className="h-4 w-4" />,
  "Licença Ambiental": <Trees className="h-4 w-4" />,
  "Uso do Solo": <MapPin className="h-4 w-4" />,
  Sanitário: <Droplets className="h-4 w-4" />,
  "Alvará Sanitário": <Droplets className="h-4 w-4" />,
};

export default function ProcessosScreen({
  processosNormalizados,
  modoFoco,
  matchesMunicipioFilter,
  matchesQuery,
  handleCopy,
}) {
  const [selectedProcessType, setSelectedProcessType] = useState(PROCESS_ALL);
  const [selectedDiversosOperacao, setSelectedDiversosOperacao] = useState(
    DIVERSOS_OPERACAO_ALL,
  );

  const filteredProcessosBase = useMemo(
    () =>
      processosNormalizados.filter(
        (proc) =>
          matchesMunicipioFilter(proc) &&
          matchesQuery([
            proc.empresa,
            proc.tipo,
            proc.tipoNormalizado,
            proc.status,
            proc.situacao,
            proc.status_padrao,
            proc.obs,
            proc.protocolo,
            proc.cnpj,
            proc.data_solicitacao,
            proc.prazo,
            proc.operacao,
            proc.orgao,
            proc.alvara,
            proc.inscricao_imobiliaria,
            proc.servico,
            proc.taxa,
            proc.notificacao,
            proc.data_val,
            proc.municipio,
            proc.tpi,
          ]),
      ),
    [matchesMunicipioFilter, matchesQuery, processosNormalizados],
  );

  const processosDisponiveis = useMemo(() => {
    if (!modoFoco) {
      return filteredProcessosBase;
    }
    return filteredProcessosBase.filter((proc) =>
      isProcessStatusActiveOrPending(proc.status),
    );
  }, [filteredProcessosBase, modoFoco]);

  const processosTipos = useMemo(() => {
    const focusGroups = new Map();
    processosDisponiveis.forEach((proc) => {
      const baseType = proc.tipoBase || proc.tipoNormalizado || proc.tipo;
      const group = focusGroups.get(baseType) || {
        tipo: baseType,
        count: 0,
        operacoes: new Map(),
      };
      group.count += 1;
      if (baseType === PROCESS_DIVERSOS_LABEL) {
        const operacaoKey = proc.diversosOperacaoKey ?? DIVERSOS_OPERACAO_SEM;
        const label = getDiversosOperacaoLabel(proc.operacao);
        const currentOperacao = group.operacoes.get(operacaoKey) || {
          key: operacaoKey,
          label,
          count: 0,
        };
        currentOperacao.count += 1;
        group.operacoes.set(operacaoKey, currentOperacao);
      }
      focusGroups.set(baseType, group);
    });

    const baseGroups = new Set();
    filteredProcessosBase.forEach((proc) => {
      const baseType = proc.tipoBase || proc.tipoNormalizado || proc.tipo;
      baseGroups.add(baseType);
    });

    const allTipos = new Set([...baseGroups, ...focusGroups.keys()]);

    return Array.from(allTipos)
      .filter(Boolean)
      .map((tipo) => {
        const focusGroup = focusGroups.get(tipo);
        const operacoes =
          tipo === PROCESS_DIVERSOS_LABEL && focusGroup
            ? Array.from(focusGroup.operacoes.values()).sort((a, b) =>
                a.label.localeCompare(b.label),
              )
            : [];
        return {
          tipo,
          count: focusGroup?.count ?? 0,
          operacoes,
        };
      })
      .sort((a, b) => a.tipo.localeCompare(b.tipo));
  }, [filteredProcessosBase, processosDisponiveis]);

  useEffect(() => {
    if (
      selectedProcessType !== PROCESS_ALL &&
      !processosTipos.some((item) => item.tipo === selectedProcessType)
    ) {
      setSelectedProcessType(PROCESS_ALL);
    }
  }, [processosTipos, selectedProcessType]);

  useEffect(() => {
    if (selectedProcessType !== PROCESS_DIVERSOS_LABEL) {
      if (selectedDiversosOperacao !== DIVERSOS_OPERACAO_ALL) {
        setSelectedDiversosOperacao(DIVERSOS_OPERACAO_ALL);
      }
      return;
    }
    const diversosEntry = processosTipos.find(
      (item) => item.tipo === PROCESS_DIVERSOS_LABEL,
    );
    const validKeys = (diversosEntry?.operacoes || []).map((op) => op.key);
    if (
      selectedDiversosOperacao !== DIVERSOS_OPERACAO_ALL &&
      !validKeys.includes(selectedDiversosOperacao)
    ) {
      setSelectedDiversosOperacao(DIVERSOS_OPERACAO_ALL);
    }
  }, [processosTipos, selectedProcessType, selectedDiversosOperacao]);

  const processosFiltrados = useMemo(() => {
    let listaBase = processosDisponiveis;
    if (selectedProcessType !== PROCESS_ALL) {
      listaBase = listaBase.filter(
        (proc) => (proc.tipoBase || proc.tipoNormalizado || proc.tipo) === selectedProcessType,
      );
    }
    if (
      selectedProcessType === PROCESS_DIVERSOS_LABEL &&
      selectedDiversosOperacao !== DIVERSOS_OPERACAO_ALL
    ) {
      listaBase = listaBase.filter((proc) => {
        if ((proc.tipoBase || proc.tipoNormalizado || proc.tipo) !== PROCESS_DIVERSOS_LABEL) {
          return false;
        }
        const key = proc.diversosOperacaoKey ?? DIVERSOS_OPERACAO_SEM;
        return key === selectedDiversosOperacao;
      });
    }
    return listaBase;
  }, [
    processosDisponiveis,
    selectedProcessType,
    selectedDiversosOperacao,
  ]);

  const renderProcessValue = useCallback(
    (proc, column) => {
      const rawValue = proc?.[column.key];
      if (column.isStatus) {
        return <StatusBadge status={proc.situacao ?? rawValue} />;
      }
      if (column.copyable) {
        const normalizedValue = normalizeIdentifier(rawValue);
        if (!normalizedValue) {
          return "—";
        }
        return (
          <button
            type="button"
            onClick={() =>
              handleCopy(normalizedValue, `${column.label} copiado: ${normalizedValue}`)
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <span>{normalizedValue}</span>
            <Clipboard className="h-3 w-3 opacity-70" aria-hidden="true" />
          </button>
        );
      }
      const displayValue = normalizeText(rawValue).trim();
      return displayValue !== "" ? displayValue : "—";
    },
    [handleCopy],
  );

  const hasProcessColumnValue = useCallback((proc, column) => {
    if (!proc || !column) return false;
    const rawValue = proc?.[column.key];
    if (column.isStatus) {
      const statusValue = proc.status ?? rawValue;
      const normalized = normalizeText(statusValue).trim();
      return (
        normalized !== "" &&
        normalized !== "*" &&
        normalized !== "-" &&
        normalized !== "—"
      );
    }
    if (column.copyable) {
      return Boolean(normalizeIdentifier(rawValue));
    }
    const normalized = normalizeText(rawValue).trim();
    return (
      normalized !== "" &&
      normalized !== "*" &&
      normalized !== "-" &&
      normalized !== "—"
    );
  }, []);

  const diversosTipoEntry = useMemo(
    () => processosTipos.find((item) => item.tipo === PROCESS_DIVERSOS_LABEL),
    [processosTipos],
  );
  const diversosOperacoes = diversosTipoEntry?.operacoes || [];

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={selectedProcessType === PROCESS_ALL ? "default" : "outline"}
          onClick={() => {
            setSelectedProcessType(PROCESS_ALL);
            setSelectedDiversosOperacao(DIVERSOS_OPERACAO_ALL);
          }}
          className="inline-flex items-center gap-1"
        >
          <Filter className="h-3.5 w-3.5" /> Todos
          <span className="text-xs">{processosDisponiveis.length}</span>
        </Button>
        {processosTipos.map(({ tipo, count }) => (
          <Button
            key={tipo}
            size="sm"
            variant={selectedProcessType === tipo ? "default" : "secondary"}
            onClick={() => {
              setSelectedProcessType(tipo);
              if (tipo !== PROCESS_DIVERSOS_LABEL) {
                setSelectedDiversosOperacao(DIVERSOS_OPERACAO_ALL);
              }
            }}
            className="inline-flex items-center gap-1"
          >
            <span className="opacity-80">
              {PROCESS_ICONS[tipo] || <Settings className="h-4 w-4" />}
            </span>
            {tipo}
            <span className="ml-1 text-xs opacity-70">{count}</span>
          </Button>
        ))}
      </div>

      {selectedProcessType === PROCESS_DIVERSOS_LABEL && diversosOperacoes.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 bg-violet-50/70 p-3">
          <Label className="text-xs uppercase text-violet-600">
            Filtrar Diversos por operação
          </Label>
          <Select value={selectedDiversosOperacao} onValueChange={setSelectedDiversosOperacao}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DIVERSOS_OPERACAO_ALL}>
                Todos os tipos ({diversosTipoEntry?.count ?? 0})
              </SelectItem>
              {diversosOperacoes.map((operacao) => (
                <SelectItem key={operacao.key} value={operacao.key}>
                  {operacao.label} ({operacao.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {processosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
          Nenhum processo correspondente ao filtro.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {processosFiltrados.map((proc, index) => {
            const baseType = proc.tipoBase || proc.tipoNormalizado || proc.tipo;
            const iconCandidate =
              PROCESS_ICONS[baseType] ||
              PROCESS_ICONS[proc.tipoNormalizado] ||
              PROCESS_ICONS[proc.tipo] || <FileText className="h-5 w-5" />;
            const tipoLabel = proc.tipoNormalizado || proc.tipo || "Processo";
            const prazoColumn = { key: "prazo", label: "Prazo" };
            const baseColumns = [...PROCESS_BASE_COLUMNS];
            if (hasProcessColumnValue(proc, prazoColumn)) {
              baseColumns.push(prazoColumn);
            }
            const extraColumns = resolveProcessExtraColumns(proc).filter((column) =>
              hasProcessColumnValue(proc, column),
            );
            const obsText = normalizeText(proc.obs).trim();
            const hasObs =
              obsText !== "" && obsText !== "-" && obsText !== "—" && obsText !== "*";

            return (
              <Card
                key={`${proc.empresa_id || proc.empresa || index}-${proc.protocolo || index}`}
                className="shadow-sm overflow-hidden border border-white/60"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 shrink-0 rounded-lg bg-violet-100 text-violet-700 grid place-items-center">
                      {iconCandidate}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold leading-tight text-slate-800 truncate">
                            {proc.empresa || "—"}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <InlineBadge variant="outline" className="bg-white">
                              {tipoLabel}
                            </InlineBadge>
                            {hasProcessColumnValue(proc, { key: "municipio" }) && proc.municipio && (
                              <InlineBadge variant="outline" className="bg-white">
                                <MapPin className="h-3 w-3 mr-1" /> {proc.municipio}
                              </InlineBadge>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={proc.status} />
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <CopyableIdentifier label="CNPJ" value={proc.cnpj} onCopy={handleCopy} />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-3 sm:grid-cols-2">
                    {baseColumns.map((column) => (
                      <div key={column.key} className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {column.label}
                        </p>
                        <div className="text-sm text-slate-700">
                          {renderProcessValue(proc, column)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {extraColumns.length > 0 && (
                    <>
                      <Separator />
                      <div className="grid gap-3 sm:grid-cols-2">
                        {extraColumns.map((column) => (
                          <div key={column.key} className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {column.label}
                            </p>
                            <div className="text-sm text-slate-700">
                              {renderProcessValue(proc, column)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {hasObs && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Observações
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{obsText}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
