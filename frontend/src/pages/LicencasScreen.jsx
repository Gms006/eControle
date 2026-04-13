import React, { useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  BookDown,
  ChartBarIncreasing,
  Clipboard,
  FileDown,
  FileMinus,
  Info,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/Chip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import InlineBadge from "@/components/InlineBadge";
import CopyableCompanyName from "@/components/CopyableCompanyName";
import { fetchJson } from "@/lib/api";
import { formatCnpj } from "@/lib/text";
import { formatStatusDisplay, getStatusKey, isAlertStatus, resolveLicencaTipo } from "@/lib/status";

const TIPOS = [
  { key: "SANITARIA", label: "Sanitária", field: "alvara_vig_sanitaria" },
  { key: "CERCON", label: "CERCON", field: "cercon" },
  { key: "FUNCIONAMENTO", label: "Funcionamento", field: "alvara_funcionamento" },
  { key: "USO_DO_SOLO", label: "Uso do Solo", field: "certidao_uso_solo" },
  { key: "AMBIENTAL", label: "Ambiental", field: "licenca_ambiental" },
];

const STATUS_OPTIONS = [
  "possui",
  "definitivo",
  "vencido",
  "sujeito",
  "nao_possui",
  "nao_exigido",
  "isento",
  "aguardando_documento",
  "aguardando_vistoria",
  "aguardando_pagamento",
  "aguardando_regularizacao",
  "aguardando_liberacao",
  "em_analise",
  "notificacao",
  "ir_na_visa",
];
const MOTIVO_OPTIONS = [
  "atividade_nao_exige",
  "zoneamento_nao_aplica",
  "porte_dispensado",
  "fase_pre_operacional",
  "mei",
  "endereco_administrativo_fiscal",
  "outro",
];

const DETECT_KIND_OPTIONS = [
  { value: "ALVARA_BOMBEIROS", label: "Alvará Bombeiros" },
  { value: "ALVARA_VIG_SANITARIA", label: "Alvará Vig Sanitária" },
  { value: "DISPENSA_SANITARIA", label: "Dispensa Sanitária" },
  { value: "ALVARA_FUNCIONAMENTO_DEFINITIVO", label: "Alvará Funcionamento - Definitivo" },
  { value: "ALVARA_FUNCIONAMENTO_CONDICIONADO", label: "Alvará Funcionamento - Condicionado" },
  { value: "ALVARA_FUNCIONAMENTO_PROVISORIO", label: "Alvará Funcionamento - Provisório" },
  { value: "USO_DO_SOLO", label: "Uso do Solo" },
  { value: "LICENCA_AMBIENTAL", label: "Licença Ambiental" },
  { value: "DISPENSA_AMBIENTAL", label: "Dispensa Ambiental" },
];

const SCORE_RISK_OPTIONS = [
  { value: "todos", label: "Todos riscos" },
  { value: "HIGH", label: "Risco alto" },
  { value: "MEDIUM", label: "Risco médio" },
  { value: "LOW", label: "Risco baixo" },
  { value: "__none__", label: "Sem risco" },
];

const SCORE_STATUS_OPTIONS = [
  { value: "todos", label: "Todos score status" },
  { value: "OK", label: "OK" },
  { value: "NO_CNAE", label: "Sem CNAE" },
  { value: "UNMAPPED_CNAE", label: "CNAE não mapeado" },
  { value: "NO_LICENCE", label: "Sem licença datada" },
  { value: "__none__", label: "Sem score status" },
];

const normalizeScoreRisk = (value) => String(value || "").trim().toUpperCase();
const normalizeScoreStatus = (value) => String(value || "").trim().toUpperCase();
const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");

const formatScoreRiskLabel = (value) => {
  const key = normalizeScoreRisk(value);
  if (key === "HIGH") return "Alto";
  if (key === "MEDIUM") return "Médio";
  if (key === "LOW") return "Baixo";
  return "—";
};

const formatScoreStatusLabel = (value) => {
  const key = normalizeScoreStatus(value);
  if (key === "OK") return "OK";
  if (key === "NO_CNAE") return "Sem CNAE";
  if (key === "UNMAPPED_CNAE") return "CNAE não mapeado";
  if (key === "NO_LICENCE") return "Sem licença datada";
  return "—";
};

const scoreRiskChipVariant = (value) => {
  const key = normalizeScoreRisk(value);
  if (key === "HIGH") return "danger";
  if (key === "MEDIUM") return "warning";
  if (key === "LOW") return "success";
  return "neutral";
};

const SORT_OPTIONS = [
  { value: "score_urgencia", label: "Score", defaultDir: "desc", isNumber: true },
  { value: "dias_para_vencer", label: "Vencimento", defaultDir: "asc", isNumber: true },
  { value: "empresa_display", label: "Empresa", defaultDir: "asc" },
  { value: "tipo", label: "Tipo", defaultDir: "asc" },
];

const DEFAULT_SORT = SORT_OPTIONS[0];

const compareWithSort = (a, b, option, direction) => {
  const dir = direction === "desc" ? -1 : 1;
  const field = option?.value;
  if (!field) return 0;
  if (option?.isNumber) {
    const av = Number.isFinite(a?.[field]) ? Number(a[field]) : null;
    const bv = Number.isFinite(b?.[field]) ? Number(b[field]) : null;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * dir;
  }
  const at = String(a?.[field] || "").trim();
  const bt = String(b?.[field] || "").trim();
  if (!at && !bt) return 0;
  if (!at) return 1;
  if (!bt) return -1;
  return at.localeCompare(bt, "pt-BR", { sensitivity: "base" }) * dir;
};

function ScoreLegendInfo() {
  return (
    <span className="relative inline-flex items-center group">
      <Info className="h-3.5 w-3.5 text-slate-500" />
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 w-64 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2 text-[11px] leading-snug text-slate-700 opacity-0 shadow-md transition group-hover:opacity-100">
        Score = maior peso CNAE + peso de vencimento.
        <br />
        Vencida: +50, até 7 dias: +40, até 30 dias: +25, até 60 dias: +10.
      </span>
    </span>
  );
}

const toUploadLicenceType = (kind, isDefinitive) => {
  const key = String(kind || "").trim().toUpperCase();
  if (!isDefinitive) return key;
  if (key === "DISPENSA_SANITARIA") return "DISPENSA_SANITARIA_DEFINITIVO";
  if (key === "DISPENSA_AMBIENTAL") return "DISPENSA_AMBIENTAL_DEFINITIVO";
  return key;
};

function UploadAssistDrawer({
  open,
  onClose,
  draft,
  setDraft,
  onConfirm,
  onAddFiles,
  uploading,
  companyOptions,
}) {
  const canSubmit = Boolean(draft?.companyId?.trim()) && (draft?.items || []).length > 0;
  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Upload assistido de licenças"
      subtitle="Detecta tipo e validade pelo nome do arquivo. Confirme antes de enviar."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onAddFiles} disabled={uploading}>
            Adicionar arquivos
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={!canSubmit || uploading}>
            {uploading ? "Enviando..." : "Enviar arquivos"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Empresa</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={draft.companyId}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                companyId: event.target.value,
              }))
            }
          >
            <option value="">Selecione</option>
            {companyOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {(item.razao_social || item.empresa || "Empresa")} - {formatCnpj(item.cnpj)}
              </option>
            ))}
          </select>
        </div>
        {(draft?.items || []).length > 0 ? (
          <p className="text-xs text-slate-600">
            Arquivos selecionados: {draft.items.length}
          </p>
        ) : null}
        <div className="space-y-3">
          {draft.items.map((item, index) => (
            <div key={`${item.originalFilename}-${index}`} className="rounded-xl border border-slate-200 p-3">
              <div className="text-sm font-medium text-slate-800">{item.originalFilename}</div>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Tipo sugerido</Label>
                  <Select
                    value={item.kind || "__none__"}
                    onValueChange={(value) =>
                      setDraft((prev) => ({
                        ...prev,
                        items: prev.items.map((current, idx) =>
                          idx === index ? { ...current, kind: value === "__none__" ? "" : value } : current,
                        ),
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Selecione</SelectItem>
                      {DETECT_KIND_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Validade</Label>
                  <Input
                    type="date"
                    value={item.expiresAt || ""}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        items: prev.items.map((current, idx) =>
                          idx === index ? { ...current, expiresAt: event.target.value } : current,
                        ),
                      }))
                    }
                    disabled={item.isDefinitive}
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.isDefinitive}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        items: prev.items.map((current, idx) =>
                          idx === index ? { ...current, isDefinitive: event.target.checked } : current,
                        ),
                      }))
                    }
                  />
                  Definitivo
                </label>
                <span>Confiança: {Math.round((item.confidence || 0) * 100)}%</span>
                {item.canonicalFilename ? <span>Canônico: {item.canonicalFilename}</span> : null}
              </div>
              {(item.warnings || []).length > 0 ? (
                <div className="mt-2 text-xs text-amber-700">{item.warnings.join(" | ")}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </SideDrawer>
  );
}

const normalizeTipo = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const parseDias = (item) => {
  const parts = parseStatusParts(item);
  const ref = item?.valid_until || parts.validadeIso || parts.validadeBr || item?.validade || item?.validade_br;
  if (!ref) return null;
  const iso = toIsoDate(ref);
  if (!iso) return null;
  const date = dayjs(iso, "YYYY-MM-DD", true);
  if (!date.isValid()) return null;
  return date.startOf("day").diff(dayjs().startOf("day"), "day");
};

const toBrDate = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[1]}/${brMatch[2]}/${brMatch[3]}`;
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  const parsed = dayjs(text, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
  if (!parsed.isValid()) return null;
  return parsed.format("DD/MM/YYYY");
};

const toIsoDate = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  const parsed = dayjs(text, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
  if (!parsed.isValid()) return null;
  return parsed.format("YYYY-MM-DD");
};

const parseStatusParts = (item) => {
  const rawStatus = String(item?.status || "").trim();
  const validUntilBr = toBrDate(item?.valid_until);
  const validUntilIso = item?.valid_until && /^\d{4}-\d{2}-\d{2}$/.test(String(item?.valid_until))
    ? String(item?.valid_until)
    : null;
  const match = rawStatus
    .toLowerCase()
    .match(/([a-z_]+?)(?:_val(?:idade)?_)?(\d{1,2})[._/-](\d{1,2})[._/-](\d{2,4})/i);

  if (match) {
    const day = String(match[2]).padStart(2, "0");
    const month = String(match[3]).padStart(2, "0");
    const year = String(match[4]).length === 2 ? `20${match[4]}` : String(match[4]);
    let baseStatus = formatStatusDisplay(match[1]);
    const validadeIso = `${year}-${month}-${day}`;
    const isDefinitive = getStatusKey(baseStatus).includes("definitiv");
    const dias = dayjs(validadeIso, "YYYY-MM-DD", true).startOf("day").diff(dayjs().startOf("day"), "day");
    if (!isDefinitive && Number.isFinite(dias) && dias < 0) {
      baseStatus = "Vencido";
    }
    return {
      baseStatus,
      validadeBr: isDefinitive ? null : `${day}/${month}/${year}`,
      validadeIso: isDefinitive ? null : validadeIso,
    };
  }

  const statusWithoutTrailingDate = rawStatus.replace(/\s*[-–]?\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s*$/u, "").trim();
  let baseStatus = formatStatusDisplay(statusWithoutTrailingDate || rawStatus || item?.status_key || "—");
  const statusDateMatch = rawStatus.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  const statusDateBr = statusDateMatch
    ? `${String(statusDateMatch[1]).padStart(2, "0")}/${String(statusDateMatch[2]).padStart(2, "0")}/${String(
        statusDateMatch[3],
      ).length === 2 ? `20${statusDateMatch[3]}` : statusDateMatch[3]}`
    : null;
  const validadeBr = validUntilBr || statusDateBr || toBrDate(item?.validade_br || item?.validade);
  const validadeIso = validUntilIso || toIsoDate(validadeBr);
  const isDefinitive = getStatusKey(baseStatus).includes("definitiv");
  if (!isDefinitive && validadeIso) {
    const dias = dayjs(validadeIso, "YYYY-MM-DD", true).startOf("day").diff(dayjs().startOf("day"), "day");
    if (Number.isFinite(dias) && dias < 0) {
      baseStatus = "Vencido";
    }
  }
  return { baseStatus, validadeBr: isDefinitive ? null : validadeBr, validadeIso: isDefinitive ? null : validadeIso };
};

const formatStatusWithDate = (item) => {
  const parts = parseStatusParts(item);
  const sourceRaw = item?.raw && typeof item.raw === "object" ? item.raw : {};
  const sourceKind = String(sourceRaw?.[`source_kind_${item?.licence_field}`] || "").toLowerCase();
  if (sourceKind === "definitivo" && getStatusKey(parts.baseStatus) === "possui") {
    return "Possui - Definitivo";
  }
  if (getStatusKey(parts.baseStatus) === "definitivo") {
    return "Possui - Definitivo";
  }
  const fallbackDate =
    toBrDate(item?.valid_until) || parts.validadeBr || toBrDate(item?.validade_br || item?.validade) || item?.validade_br_display;
  if (fallbackDate && !getStatusKey(parts.baseStatus).includes("definitiv")) {
    return `${parts.baseStatus} - ${fallbackDate}`;
  }
  return parts.baseStatus;
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
    setStatus(item?.status_key_canonical || getStatusKey(item?.status).replace(/\s+/g, "_") || "possui");
    setValidade(item?.valid_until || item?.validade || "");
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
  empresas,
  modoFoco,
  canManageLicencas,
  handleCopy,
  enqueueToast,
  onRefreshData,
  panelPreset,
}) {
  const [view, setView] = useState("renovacoes");
  const [quickMunicipio, setQuickMunicipio] = useState("todos");
  const [quickTipo, setQuickTipo] = useState("todos");
  const [quickStatus, setQuickStatus] = useState("todos");
  const [quickScoreRisk, setQuickScoreRisk] = useState("todos");
  const [quickScoreStatus, setQuickScoreStatus] = useState("todos");
  const [sortField, setSortField] = useState(DEFAULT_SORT.value);
  const [sortDir, setSortDir] = useState(DEFAULT_SORT.defaultDir);
  const [somenteAlertasLocal, setSomenteAlertasLocal] = useState(false);
  const [drawerItem, setDrawerItem] = useState(null);
  const [kpiFilter, setKpiFilter] = useState("todos");
  const [priorityGroup, setPriorityGroup] = useState("todos");
  const [uploading, setUploading] = useState(false);
  const [scanRunning, setScanRunning] = useState(false);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [uploadDraft, setUploadDraft] = useState({ companyId: "", items: [] });
  const fileInputRef = useRef(null);
  const appendUploadSelectionRef = useRef(false);

  React.useEffect(() => {
    const preset = panelPreset?.preset;
    if (!preset || panelPreset?.tab !== "licencas") return;
    setView("renovacoes");
    setSomenteAlertasLocal(false);
    setQuickMunicipio("todos");
    setQuickTipo("todos");
    setQuickStatus("todos");
    setQuickScoreRisk("todos");
    setQuickScoreStatus("todos");
    setSortField(DEFAULT_SORT.value);
    setSortDir(DEFAULT_SORT.defaultDir);
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
        const companyId = String(item?.company_id || item?.empresa_id || "").trim();
        const companyById =
          companyId && Array.isArray(empresas)
            ? empresas.find((company) => String(company?.id || company?.company_id || "").trim() === companyId)
            : undefined;
        const itemCnpj = normalizeDigits(item?.cnpj || item?.company_cnpj);
        const companyByCnpj =
          !companyById && itemCnpj && Array.isArray(empresas)
            ? empresas.find((company) => normalizeDigits(company?.cnpj) === itemCnpj)
            : undefined;
        const companySnapshot = companyById || companyByCnpj;
        const tipoNorm = normalizeTipo(item?.tipo);
        const parsedStatus = parseStatusParts(item);
        const diasParaVencer = parseDias(item);
        const statusKeyCanonical = item?.status_key_canonical || toCanonicalStatusKey(parsedStatus.baseStatus);
        const scoreUrgenciaRaw = companySnapshot?.score_urgencia ?? companySnapshot?.scoreUrgencia;
        const scoreUrgencia = Number.isFinite(scoreUrgenciaRaw) ? Number(scoreUrgenciaRaw) : null;
        const scoreRisk = normalizeScoreRisk(
          companySnapshot?.risco_consolidado ?? companySnapshot?.riscoConsolidado,
        );
        const scoreStatus = normalizeScoreStatus(
          companySnapshot?.score_status ?? companySnapshot?.scoreStatus,
        );
        return {
          ...item,
          tipo_norm: tipoNorm,
          empresa_display: displayEmpresa(item),
          status_key: statusKeyCanonical,
          status_key_canonical: statusKeyCanonical,
          sem_vinculo: Boolean(item?.sem_vinculo) || !item?.empresa,
          status_label: parsedStatus.baseStatus,
          validade_br_display: toBrDate(item?.valid_until) || parsedStatus.validadeBr,
          validade_iso_display: item?.valid_until || parsedStatus.validadeIso,
          criticidade: classify(item),
          dias_para_vencer: Number.isFinite(diasParaVencer) ? diasParaVencer : null,
          score_urgencia: scoreUrgencia,
          risco_consolidado: scoreRisk || null,
          score_status: scoreStatus || null,
        };
      }),
    [base, empresas],
  );

  const municipios = useMemo(() => ["todos", ...Array.from(new Set(rows.map((r) => r?.municipio).filter(Boolean)))], [rows]);

  const filteredBase = useMemo(
    () =>
      rows.filter((item) => {
        if (quickMunicipio !== "todos" && item?.municipio !== quickMunicipio) return false;
        if (quickTipo !== "todos" && item?.tipo_norm !== quickTipo) return false;
        if (quickStatus !== "todos" && item?.status_key_canonical !== quickStatus) return false;
        if (
          quickScoreRisk !== "todos" &&
          ((quickScoreRisk === "__none__" && item?.risco_consolidado) ||
            (quickScoreRisk !== "__none__" && item?.risco_consolidado !== quickScoreRisk))
        ) {
          return false;
        }
        if (
          quickScoreStatus !== "todos" &&
          ((quickScoreStatus === "__none__" && item?.score_status) ||
            (quickScoreStatus !== "__none__" && item?.score_status !== quickScoreStatus))
        ) {
          return false;
        }
        if (somenteAlertasLocal && !isAlertStatus(item?.status)) return false;
        if (priorityGroup !== "todos" && item?.criticidade !== priorityGroup) return false;
        return true;
      }),
    [
      priorityGroup,
      quickMunicipio,
      quickScoreRisk,
      quickScoreStatus,
      quickStatus,
      quickTipo,
      rows,
      somenteAlertasLocal,
    ],
  );

  const filtered = useMemo(
    () =>
      filteredBase.filter((item) => {
        if (kpiFilter !== "todos" && item?.status_key_canonical !== kpiFilter) return false;
        return true;
      }),
    [filteredBase, kpiFilter],
  );

  const sortedFiltered = useMemo(() => {
    const selectedSort = SORT_OPTIONS.find((option) => option.value === sortField) || DEFAULT_SORT;
    const comparator = (a, b) => {
      const primary = compareWithSort(a, b, selectedSort, sortDir);
      if (primary !== 0) return primary;
      const secondary = compareWithSort(a, b, DEFAULT_SORT, DEFAULT_SORT.defaultDir);
      if (secondary !== 0) return secondary;
      return compareWithSort(a, b, { value: "empresa_display" }, "asc");
    };
    return [...filtered].sort(comparator);
  }, [filtered, sortDir, sortField]);

  const grouped = useMemo(() => {
    const selectedSort = SORT_OPTIONS.find((option) => option.value === sortField) || DEFAULT_SORT;
    const comparator = (a, b) => {
      const primary = compareWithSort(a, b, selectedSort, sortDir);
      if (primary !== 0) return primary;
      const secondary = compareWithSort(a, b, DEFAULT_SORT, DEFAULT_SORT.defaultDir);
      if (secondary !== 0) return secondary;
      return compareWithSort(a, b, { value: "empresa_display" }, "asc");
    };
    const map = new Map(groupConfig.map((cfg) => [cfg.key, []]));
    filtered.forEach((item) => {
      if (item.criticidade && map.has(item.criticidade)) map.get(item.criticidade).push(item);
    });
    map.forEach((list) => list.sort(comparator));
    return map;
  }, [filtered, sortDir, sortField]);

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

  const companyOptions = useMemo(
    () =>
      (empresas || [])
        .filter((item) => item?.id)
        .map((item) => ({
          id: String(item.id),
          razao_social: item?.razao_social || item?.empresa || "",
          cnpj: item?.cnpj || "",
        }))
        .sort((a, b) => (a.razao_social || "").localeCompare(b.razao_social || "")),
    [empresas],
  );

  const triggerUpload = () => {
    if (!canManageLicencas || uploading) return;
    appendUploadSelectionRef.current = false;
    fileInputRef.current?.click();
  };

  const triggerAddUploadFiles = () => {
    if (!canManageLicencas || uploading) return;
    appendUploadSelectionRef.current = true;
    fileInputRef.current?.click();
  };

  const triggerScanFull = async () => {
    if (!canManageLicencas || scanRunning) return;
    setScanRunning(true);
    try {
      const response = await fetchJson("/api/v1/licencas/scan-full", { method: "POST" });
      const runId = response?.run_id;
      enqueueToast?.(`Scan completo iniciado${runId ? ` (run ${runId})` : ""}.`);
      if (!runId) {
        await onRefreshData?.();
        return;
      }
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const statusPayload = await fetchJson(`/api/v1/worker/jobs/${runId}`);
        const status = String(statusPayload?.status || "").toLowerCase();
        if (status === "done") {
          enqueueToast?.("Scan completo concluído.");
          await onRefreshData?.();
          return;
        }
        if (status === "error") {
          const reason = statusPayload?.errors?.[0]?.error;
          enqueueToast?.(reason ? `Scan completo com erro: ${reason}` : "Scan completo com erro.");
          await onRefreshData?.();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      enqueueToast?.("Scan completo em andamento. Consulte o status novamente em instantes.");
    } catch (error) {
      enqueueToast?.(error?.message || "Falha ao iniciar scan completo.");
    } finally {
      setScanRunning(false);
    }
  };

  const detectUploadItems = async (files) => {
    try {
      const detectForm = new FormData();
      files.forEach((file) => detectForm.append("items", file));
      const detectResponse = await fetchJson("/api/v1/licencas/detect", {
        method: "POST",
        body: detectForm,
      });
      const detectedItems = Array.isArray(detectResponse?.results) ? detectResponse.results : [];
      return files.map((file, index) => {
        const detected = detectedItems[index] || {};
        return {
          file,
          originalFilename: file.name,
          kind: detected.suggested_document_kind || "",
          expiresAt: detected.suggested_expires_at || "",
          isDefinitive: Boolean(detected.is_definitive),
          confidence: Number(detected.confidence || 0),
          warnings: Array.isArray(detected.warnings) ? detected.warnings : [],
          canonicalFilename: detected.canonical_filename || null,
        };
      });
    } catch (error) {
      enqueueToast?.(error?.message || "Falha ao detectar licenças.");
      return [];
    }
  };

  const onSelectFiles = async (event) => {
    if (!canManageLicencas) return;
    const files = Array.from(event?.target?.files || []);
    event.target.value = "";
    if (!files.length) return;
    const detectedItems = await detectUploadItems(files);
    if (!detectedItems.length) {
      appendUploadSelectionRef.current = false;
      return;
    }

    const shouldAppend = appendUploadSelectionRef.current;
    appendUploadSelectionRef.current = false;
    if (shouldAppend) {
      setUploadDraft((prev) => ({
        companyId: prev.companyId || "",
        items: [...(prev.items || []), ...detectedItems],
      }));
    } else {
      setUploadDraft({
        companyId: "",
        items: detectedItems,
      });
    }
    setUploadDrawerOpen(true);
  };

  const submitAssistedUpload = async () => {
    if (!canManageLicencas || uploading) return;
    if (!uploadDraft.companyId?.trim()) {
      enqueueToast?.("Informe o company_id.");
      return;
    }
    for (const item of uploadDraft.items) {
      const kind = String(item.kind || "").trim();
      if (!kind) {
        enqueueToast?.(`Defina o tipo para ${item.originalFilename}.`);
        return;
      }
      const requiresExpiry = !item.isDefinitive && !String(kind).includes("DEFINITIVO");
      if (requiresExpiry && !item.expiresAt) {
        enqueueToast?.(`Defina a validade para ${item.originalFilename}.`);
        return;
      }
    }

    const formData = new FormData();
    formData.append("company_id", uploadDraft.companyId.trim());
    uploadDraft.items.forEach((item) => {
      formData.append("items", item.file);
      formData.append("licence_type", toUploadLicenceType(item.kind, item.isDefinitive));
      formData.append("expires_at", item.isDefinitive ? "" : (item.expiresAt || ""));
    });

    setUploading(true);
    try {
      const response = await fetchJson("/api/v1/licencas/upload-bulk", {
        method: "POST",
        body: formData,
      });
      const okCount = Number(response?.saved_count || 0);
      const total = Array.isArray(response?.results) ? response.results.length : uploadDraft.items.length;
      enqueueToast?.(`Upload concluído: ${okCount}/${total} arquivos salvos.`);
      setUploadDrawerOpen(false);
      await onRefreshData?.();
    } catch (error) {
      enqueueToast?.(error?.message || "Falha no upload de licenças.");
    } finally {
      setUploading(false);
    }
  };

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
        {canManageLicencas && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                data-testid="licencas-upload-action"
                disabled={uploading || scanRunning}
              >
                {uploading ? "Enviando..." : (scanRunning ? "Escaneando..." : "Atualizar licenças")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={triggerUpload} data-testid="licencas-action-new">
                <FileDown className="mr-2 h-4 w-4" />
                Nova Licença
              </DropdownMenuItem>
              <DropdownMenuItem onClick={triggerScanFull} data-testid="licencas-action-scan-full">
                <BookDown className="mr-2 h-4 w-4" />
                Scan Completo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          multiple
          accept=".pdf,.jpg,.png"
          onChange={onSelectFiles}
        />
      </div>

      <Card className="shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
          <Select value={quickMunicipio} onValueChange={setQuickMunicipio}>
            <SelectTrigger className="w-[180px]">
              <MapPin className="h-4 w-4 text-slate-500" />
              <SelectValue placeholder="Município" />
            </SelectTrigger>
            <SelectContent>{municipios.map((m) => <SelectItem key={m} value={m}>{m === "todos" ? "Todos municípios" : m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={quickTipo} onValueChange={setQuickTipo}>
            <SelectTrigger className="w-[180px]">
              <FileMinus className="h-4 w-4 text-slate-500" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos tipos</SelectItem>
              {TIPOS.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={quickStatus} onValueChange={setQuickStatus}>
            <SelectTrigger className="w-[180px]">
              <Clipboard className="h-4 w-4 text-slate-500" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              {STATUS_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{formatStatusDisplay(opt)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={quickScoreRisk} onValueChange={setQuickScoreRisk}>
            <SelectTrigger className="w-[180px]" data-testid="licencas-score-risk-filter">
              <ChartBarIncreasing className="h-4 w-4 text-slate-500" />
              <SelectValue placeholder="Risco score" />
            </SelectTrigger>
            <SelectContent>
              {SCORE_RISK_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={quickScoreStatus} onValueChange={setQuickScoreStatus}>
            <SelectTrigger className="w-[220px]" data-testid="licencas-score-status-filter">
              <SelectValue placeholder="Status score" />
            </SelectTrigger>
            <SelectContent>
              {SCORE_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant={somenteAlertasLocal ? "default" : "secondary"} onClick={() => setSomenteAlertasLocal(!somenteAlertasLocal)}>
            Somente alertas
          </Button>
          <InlineBadge variant="outline" className="bg-white">{filtered.length} itens</InlineBadge>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ordenar por</span>
          <div className="flex flex-wrap items-center gap-2">
            {SORT_OPTIONS.map((option) => {
              const isActive = sortField === option.value;
              const directionSymbol = isActive ? (sortDir === "asc" ? "↑" : "↓") : null;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                    } else {
                      setSortField(option.value);
                      setSortDir(option.defaultDir);
                    }
                  }}
                  className={[
                    "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition",
                    "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    isActive ? "border-brand-navy/30 bg-brand-navy-soft text-brand-navy shadow-sm" : "",
                  ].join(" ")}
                >
                  <span>{option.label}</span>
                  {directionSymbol ? <span className="text-xs">{directionSymbol}</span> : null}
                </button>
              );
            })}
          </div>
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
                          <CopyableCompanyName value={item.empresa_display} onCopy={handleCopy} size="base" />
                          <StatusBadge
                            status={formatStatusWithDate(item)}
                          />
                          {item.sem_vinculo && <Chip variant="danger">Sem vínculo</Chip>}
                          <Chip variant={resolveLicencaTipo(item.tipo).variant}>{resolveLicencaTipo(item.tipo).label}</Chip>
                          <Chip data-testid="licencas-score-urgencia" variant="outline">
                            Score: {Number.isFinite(item?.score_urgencia) ? item.score_urgencia : "—"}}
                            <ScoreLegendInfo />
                          </Chip>
                          <Chip data-testid="licencas-score-risk" variant={scoreRiskChipVariant(item?.risco_consolidado)}>
                            Risco: {formatScoreRiskLabel(item?.risco_consolidado)}
                          </Chip>
                          <Chip data-testid="licencas-score-status" variant="neutral">
                            Status score: {formatScoreStatusLabel(item?.score_status)}
                          </Chip>
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
                                  status={formatStatusWithDate(cell)}
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
                    {sortedFiltered.map((item, idx) => (
                        <TableRow key={`${item.id}-${idx}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CopyableCompanyName value={item.empresa_display} onCopy={handleCopy} size="base" />
                              {item.sem_vinculo && <Chip variant="danger">Sem vínculo</Chip>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip variant={resolveLicencaTipo(item.tipo).variant}>{resolveLicencaTipo(item.tipo).label}</Chip>
                          </TableCell>
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
      <UploadAssistDrawer
        open={uploadDrawerOpen}
        onClose={() => setUploadDrawerOpen(false)}
        draft={uploadDraft}
        setDraft={setUploadDraft}
        onConfirm={submitAssistedUpload}
        onAddFiles={triggerAddUploadFiles}
        uploading={uploading}
        companyOptions={companyOptions}
      />
    </div>
  );
}
