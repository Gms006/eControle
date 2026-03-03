import React, { useMemo, useState } from "react";
import dayjs from "dayjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/Chip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import InlineBadge from "@/components/InlineBadge";
import { fetchJson } from "@/lib/api";
import { formatStatusDisplay, getStatusKey, isAlertStatus } from "@/lib/status";

const TIPOS = [
  { key: "SANITARIA", label: "Sanitária", field: "alvara_vig_sanitaria" },
  { key: "CERCON", label: "CERCON", field: "cercon" },
  { key: "FUNCIONAMENTO", label: "Funcionamento", field: "alvara_funcionamento" },
  { key: "USO_DO_SOLO", label: "Uso do Solo", field: "certidao_uso_solo" },
  { key: "AMBIENTAL", label: "Ambiental", field: "licenca_ambiental" },
];

const STATUS_OPTIONS = ["possui", "vencido", "sujeito", "nao_possui", "nao_exigido"];
const MOTIVO_OPTIONS = [
  "atividade_nao_exige",
  "zoneamento_nao_aplica",
  "porte_dispensado",
  "fase_pre_operacional",
  "mei",
  "endereco_administrativo_fiscal",
  "outro",
];

const normalizeTipo = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const parseDias = (item) => {
  const parts = parseStatusParts(item);
  const ref = parts.validadeIso || parts.validadeBr || item?.validade || item?.validade_br;
  if (!ref) return null;
  const date = dayjs(ref, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
  if (!date.isValid()) return null;
  return date.startOf("day").diff(dayjs().startOf("day"), "day");
};

const toBrDate = (value) => {
  if (!value) return null;
  const parsed = dayjs(value, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
  if (!parsed.isValid()) return null;
  return parsed.format("DD/MM/YYYY");
};

const parseStatusParts = (item) => {
  const rawStatus = String(item?.status || "").trim();
  const match = rawStatus
    .toLowerCase()
    .match(/(vencido|sujeito|definitivo|possui)(?:_val(?:idade)?_)?(\d{1,2})[_/-](\d{1,2})[_/-](\d{2,4})/i);

  if (match) {
    const day = String(match[2]).padStart(2, "0");
    const month = String(match[3]).padStart(2, "0");
    const year = String(match[4]).length === 2 ? `20${match[4]}` : String(match[4]);
    const baseStatus = formatStatusDisplay(match[1]);
    return {
      baseStatus,
      validadeBr: `${day}/${month}/${year}`,
      validadeIso: `${year}-${month}-${day}`,
    };
  }

  const baseStatus = formatStatusDisplay(rawStatus || item?.status_key || "—");
  const validadeBr = toBrDate(item?.validade_br || item?.validade);
  const validadeIso = validadeBr
    ? dayjs(validadeBr, "DD/MM/YYYY", true).format("YYYY-MM-DD")
    : null;
  return { baseStatus, validadeBr, validadeIso };
};

const toCanonicalStatusKey = (value) => getStatusKey(value).replace(/\s+/g, "_");

const displayEmpresa = (item) => {
  if (item?.company_razao_social) return item.company_razao_social;
  if (item?.empresa) return item.empresa;
  if (item?.company_name) return item.company_name;
  if (item?.cnpj) return item.cnpj;
  if (item?.empresa_id || item?.company_id) {
    return `Empresa não vinculada (ID ${item?.empresa_id || item?.company_id})`;
  }
  return "Empresa não vinculada";
};

const classify = (item) => {
  const key = item?.status_key_canonical || toCanonicalStatusKey(parseStatusParts(item).baseStatus);
  const dias = parseDias(item);
  if (!key || key === "sem_status") return "sem_status";
  if (key === "nao_possui") return "nao_possui";
  if (key.includes("vencido") || (typeof dias === "number" && dias < 0)) return "vencido";
  if (typeof dias === "number" && dias <= 7) return "ate7";
  if (typeof dias === "number" && dias <= 15) return "ate15";
  if (typeof dias === "number" && dias <= 30) return "ate30";
  return null;
};

const groupConfig = [
  { key: "vencido", label: "Vencido", variant: "danger" },
  { key: "ate7", label: "Vence em <=7 dias", variant: "danger" },
  { key: "ate15", label: "Vence em <=15 dias", variant: "warning" },
  { key: "ate30", label: "Vence em <=30 dias", variant: "warning" },
  { key: "nao_possui", label: "Não possui (obrigatório/urgente)", variant: "danger" },
  { key: "sem_status", label: "Sem status (backlog)", variant: "warning" },
];

function EditDrawer({ open, item, onClose, onSaved, enqueueToast }) {
  const [status, setStatus] = useState("possui");
  const [validade, setValidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [observacao, setObservacao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [proximaAcao, setProximaAcao] = useState("");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!open || !item) return;
    setStatus(getStatusKey(item?.status).replace(/\s+/g, "_") || "possui");
    setValidade(item?.validade || "");
    setMotivo(item?.motivo_nao_exigido || "");
    setJustificativa(item?.justificativa_nao_exigido || "");
    setObservacao(item?.observacao || "");
    setResponsavel(item?.responsavel || "");
    setProximaAcao(item?.proxima_acao || "");
  }, [open, item]);

  const handleSave = async () => {
    if (!item?.licence_id || !item?.licence_field) {
      enqueueToast?.("Registro sem referência de edição.");
      return;
    }
    if (status === "nao_exigido" && (!motivo || !justificativa.trim())) {
      enqueueToast?.("Informe motivo e justificativa para Não exigido.");
      return;
    }
    setSaving(true);
    try {
      await fetchJson(`/api/v1/licencas/${item.licence_id}/item`, {
        method: "PATCH",
        body: {
          field: item.licence_field,
          status,
          validade: validade || null,
          motivo_nao_exigido: status === "nao_exigido" ? motivo : null,
          justificativa_nao_exigido: status === "nao_exigido" ? justificativa : null,
          observacao: observacao || null,
          responsavel: responsavel || null,
          proxima_acao: proximaAcao || null,
        },
      });
      enqueueToast?.("Licença atualizada.");
      await onSaved?.();
      onClose?.();
    } catch (error) {
      enqueueToast?.(error?.message || "Falha ao atualizar licença.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Edição rápida de licença"
      subtitle={displayEmpresa(item)}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>{formatStatusDisplay(opt)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Vencimento</Label>
          <Input type="date" value={validade || ""} onChange={(e) => setValidade(e.target.value)} />
        </div>
        {status === "nao_exigido" && (
          <>
            <div>
              <Label>Motivo padrão</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {MOTIVO_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{formatStatusDisplay(opt)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Justificativa/Base</Label>
              <Input value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
            </div>
          </>
        )}
        <div>
          <Label>Observação</Label>
          <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>
        <div>
          <Label>Responsável</Label>
          <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
        </div>
        <div>
          <Label>Próxima ação</Label>
          <Input value={proximaAcao} onChange={(e) => setProximaAcao(e.target.value)} />
        </div>

        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Detalhes sob demanda</summary>
          <div className="mt-3 space-y-2 text-xs text-slate-600">
            <div><strong>Status bruto:</strong> {item?.status || "—"}</div>
            <div><strong>Tipo:</strong> {item?.tipo || "—"}</div>
            <div><strong>Município:</strong> {item?.municipio || "—"}</div>
            <div><strong>CNPJ:</strong> {item?.cnpj || "—"}</div>
          </div>
        </details>
      </div>
    </SideDrawer>
  );
}

export default function LicencasScreen({
  licencas,
  filteredLicencas,
  modoFoco,
  handleCopy,
  enqueueToast,
  onRefreshData,
  panelPreset,
}) {
  const [view, setView] = useState("renovacoes");
  const [quickMunicipio, setQuickMunicipio] = useState("todos");
  const [quickTipo, setQuickTipo] = useState("todos");
  const [quickStatus, setQuickStatus] = useState("todos");
  const [somenteAlertasLocal, setSomenteAlertasLocal] = useState(false);
  const [drawerItem, setDrawerItem] = useState(null);
  const [kpiFilter, setKpiFilter] = useState("todos");
  const [priorityGroup, setPriorityGroup] = useState("todos");

  React.useEffect(() => {
    const preset = panelPreset?.preset;
    if (!preset || panelPreset?.tab !== "licencas") return;
    setView("renovacoes");
    setSomenteAlertasLocal(false);
    setQuickMunicipio("todos");
    setQuickTipo("todos");
    setQuickStatus("todos");
    setKpiFilter("todos");
    setPriorityGroup(preset?.group || "todos");
  }, [panelPreset]);

  const base = useMemo(
    () => (modoFoco ? (filteredLicencas || []).filter((item) => isAlertStatus(item?.status)) : filteredLicencas || []),
    [filteredLicencas, modoFoco],
  );

  const rows = useMemo(
    () =>
      base.map((item) => {
        const tipoNorm = normalizeTipo(item?.tipo);
        const parsedStatus = parseStatusParts(item);
        const statusKeyCanonical = toCanonicalStatusKey(parsedStatus.baseStatus);
        return {
          ...item,
          tipo_norm: tipoNorm,
          empresa_display: displayEmpresa(item),
          status_key: statusKeyCanonical,
          status_key_canonical: statusKeyCanonical,
          sem_vinculo: Boolean(item?.sem_vinculo) || !item?.empresa,
          status_label: parsedStatus.baseStatus,
          validade_br_display: parsedStatus.validadeBr,
          validade_iso_display: parsedStatus.validadeIso,
          criticidade: classify(item),
        };
      }),
    [base],
  );

  const municipios = useMemo(() => ["todos", ...Array.from(new Set(rows.map((r) => r?.municipio).filter(Boolean)))], [rows]);

  const filteredBase = useMemo(
    () =>
      rows.filter((item) => {
        if (quickMunicipio !== "todos" && item?.municipio !== quickMunicipio) return false;
        if (quickTipo !== "todos" && item?.tipo_norm !== quickTipo) return false;
        if (quickStatus !== "todos" && item?.status_key_canonical !== quickStatus) return false;
        if (somenteAlertasLocal && !isAlertStatus(item?.status)) return false;
        if (priorityGroup !== "todos" && item?.criticidade !== priorityGroup) return false;
        return true;
      }),
    [priorityGroup, quickMunicipio, quickStatus, quickTipo, rows, somenteAlertasLocal],
  );

  const filtered = useMemo(
    () =>
      filteredBase.filter((item) => {
        if (kpiFilter !== "todos" && item?.status_key_canonical !== kpiFilter) return false;
        return true;
      }),
    [filteredBase, kpiFilter],
  );

  const grouped = useMemo(() => {
    const map = new Map(groupConfig.map((cfg) => [cfg.key, []]));
    filtered.forEach((item) => {
      if (item.criticidade && map.has(item.criticidade)) map.get(item.criticidade).push(item);
    });
    map.forEach((list) =>
      list.sort((a, b) => {
        const da = parseDias(a);
        const db = parseDias(b);
        if (da == null && db == null) return a.empresa_display.localeCompare(b.empresa_display);
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      }),
    );
    return map;
  }, [filtered]);

  const empresasMatriz = useMemo(() => {
    const map = new Map();
    filtered.forEach((item) => {
      const key = item?.empresa_id || item?.company_id || item?.cnpj || item?.empresa_display;
      if (!map.has(key)) {
        map.set(key, {
          key,
          empresa: item.empresa_display,
          cnpj: item?.cnpj,
          municipio: item?.municipio,
          sem_vinculo: item?.sem_vinculo,
          byTipo: {},
        });
      }
      map.get(key).byTipo[item.tipo_norm] = item;
    });
    return Array.from(map.values()).sort((a, b) => a.empresa.localeCompare(b.empresa));
  }, [filtered]);

  const kpis = useMemo(() => {
    const all = filteredBase.length;
    const make = (status) => filteredBase.filter((r) => r.status_key_canonical === status).length;
    return [
      { key: "todos", label: "Total", value: all },
      { key: "vencido", label: "Vencido", value: make("vencido") },
      { key: "nao_possui", label: "Não possui", value: make("nao_possui") },
      { key: "sujeito", label: "Sujeito", value: make("sujeito") },
      { key: "nao_exigido", label: "Não exigido", value: make("nao_exigido") },
    ];
  }, [filteredBase]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={view === "renovacoes" ? "default" : "secondary"} onClick={() => setView("renovacoes")}>
          Renovações
        </Button>
        <Button size="sm" variant={view === "matriz" ? "default" : "secondary"} onClick={() => setView("matriz")}>
          Matriz por empresa
        </Button>
        <Button size="sm" variant={view === "tipos" ? "default" : "secondary"} onClick={() => setView("tipos")}>
          Por tipo
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
          <Select value={quickMunicipio} onValueChange={setQuickMunicipio}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Município" /></SelectTrigger>
            <SelectContent>{municipios.map((m) => <SelectItem key={m} value={m}>{m === "todos" ? "Todos municípios" : m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={quickTipo} onValueChange={setQuickTipo}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos tipos</SelectItem>
              {TIPOS.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={quickStatus} onValueChange={setQuickStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              {STATUS_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{formatStatusDisplay(opt)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant={somenteAlertasLocal ? "default" : "secondary"} onClick={() => setSomenteAlertasLocal(!somenteAlertasLocal)}>
            Somente alertas
          </Button>
          <InlineBadge variant="outline" className="bg-white">{filtered.length} itens</InlineBadge>
        </CardContent>
      </Card>

      {view === "renovacoes" && (
        <div className="space-y-3">
          {groupConfig.map((cfg) => {
            const list = grouped.get(cfg.key) || [];
            return (
              <Card key={cfg.key}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {cfg.label}
                    <InlineBadge variant="outline">{list.length}</InlineBadge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {list.length === 0 && <p className="text-sm text-slate-500">Sem itens neste grupo.</p>}
                  {list.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{item.empresa_display}</span>
                          <StatusBadge
                            status={
                              item.validade_br_display
                                ? `${item.status_label} - ${item.validade_br_display}`
                                : item.status_label
                            }
                          />
                          {item.sem_vinculo && <Chip variant="danger">Sem vínculo</Chip>}
                          <Chip variant="neutral">{item.tipo}</Chip>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="secondary" onClick={() => setDrawerItem(item)}>Detalhes</Button>
                          <Button size="sm" variant="secondary" onClick={() => enqueueToast?.("Processo iniciado (atalho).")}>Iniciar processo</Button>
                          <Button size="sm" variant="secondary" onClick={() => enqueueToast?.("Contato registrado (atalho).")}>Registrar contato</Button>
                          {item?.cnpj && handleCopy && (
                            <Button size="sm" variant="secondary" onClick={() => handleCopy(item.cnpj, `CNPJ copiado: ${item.cnpj}`)}>Copiar CNPJ</Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {view === "matriz" && (
        <Card>
          <CardHeader>
            <CardTitle>Matriz de conformidade por empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[620px]">
              <Table>
                <TableHeader className="sticky top-0 z-30 bg-slate-50">
                  <TableRow>
                    <TableHead className="sticky left-0 top-0 z-40 bg-slate-50">Empresa</TableHead>
                    {TIPOS.map((t) => (
                      <TableHead key={t.key} className="top-0 z-30 bg-slate-50">{t.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresasMatriz.map((emp) => (
                    <TableRow key={emp.key}>
                      <TableCell className="sticky left-0 z-10 bg-white">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{emp.empresa}</span>
                          {emp.sem_vinculo && <Chip variant="danger">Sem vínculo</Chip>}
                        </div>
                        <div className="text-xs text-slate-500">{emp.cnpj || "—"} {emp.municipio ? `• ${emp.municipio}` : ""}</div>
                      </TableCell>
                      {TIPOS.map((tipo) => {
                        const cell = emp.byTipo[tipo.key];
                        return (
                          <TableCell key={`${emp.key}-${tipo.key}`}>
                            <button
                              type="button"
                              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-left hover:bg-slate-50"
                              onClick={() => cell ? setDrawerItem(cell) : enqueueToast?.("Sem registro para edição neste tipo.")}
                            >
                              {cell ? (
                                <StatusBadge
                                  status={
                                    cell.validade_br_display
                                      ? `${cell.status_label} - ${cell.validade_br_display}`
                                      : cell.status_label
                                  }
                                />
                              ) : (
                                <Chip variant="neutral">Sem dado</Chip>
                              )}
                            </button>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {view === "tipos" && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-5">
            {kpis.map((kpi) => (
              <button
                key={kpi.key}
                type="button"
                onClick={() => setKpiFilter((current) => (current === kpi.key ? "todos" : kpi.key))}
                className={`rounded-xl border p-3 text-left ${kpiFilter === kpi.key ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}
              >
                <div className="text-xs uppercase text-slate-500">{kpi.label}</div>
                <div className="text-2xl font-semibold">{kpi.value}</div>
              </button>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Tabela por tipo</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[560px]">
                <Table>
                  <TableHeader className="sticky top-0 z-20 bg-slate-50">
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Município</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...filtered]
                      .sort((a, b) => {
                        const da = parseDias(a);
                        const db = parseDias(b);
                        if (da == null && db == null) return a.empresa_display.localeCompare(b.empresa_display);
                        if (da == null) return 1;
                        if (db == null) return -1;
                        return da - db;
                      })
                      .map((item, idx) => (
                        <TableRow key={`${item.id}-${idx}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.empresa_display}</span>
                              {item.sem_vinculo && <Chip variant="danger">Sem vínculo</Chip>}
                            </div>
                          </TableCell>
                          <TableCell>{item.tipo}</TableCell>
                          <TableCell><StatusBadge status={item.status_label} /></TableCell>
                          <TableCell>{item.validade_br_display || "—"}</TableCell>
                          <TableCell>{item.municipio || "—"}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      <EditDrawer
        open={Boolean(drawerItem)}
        item={drawerItem}
        onClose={() => setDrawerItem(null)}
        onSaved={onRefreshData}
        enqueueToast={enqueueToast}
      />
    </div>
  );
}
