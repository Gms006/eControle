import React, { useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  AlertTriangle,
  ArrowUpDown,
  BookDown,
  ChartBarIncreasing,
  ChevronDown,
  Clipboard,
  Clock3,
  FileDown,
  FileMinus,
  Info,
  LayoutGrid,
  Logs,
  MapPin,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import CopyableCompanyName from "@/components/CopyableCompanyName";
import { fetchJson } from "@/lib/api";
import { formatCnpj } from "@/lib/text";
import { formatStatusDisplay, getStatusKey, isAlertStatus, resolveLicencaTipo } from "@/lib/status";
import { cn } from "@/lib/utils";

const TIPOS = [
  { key: "SANITARIA", label: "Sanitária", field: "alvara_vig_sanitaria" },
  { key: "CERCON", label: "CERCON", field: "cercon" },
  { key: "FUNCIONAMENTO", label: "Funcionamento", field: "alvara_funcionamento" },
  { key: "USO_DO_SOLO", label: "Uso do Solo", field: "certidao_uso_solo" },
  { key: "AMBIENTAL", label: "Ambiental", field: "licenca_ambiental" },
];

const MATRIX_TIPOS = [
  { key: "SANITARIA", label: "Vig. Sanitária" },
  { key: "CERCON", label: "CERCON" },
  { key: "FUNCIONAMENTO", label: "Funcionamento" },
  { key: "AMBIENTAL", label: "Ambiental" },
  { key: "USO_DO_SOLO", label: "Uso do Solo" },
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

const ALVARA_FUNCIONAMENTO_KIND_OPTIONS = [
  { value: "DEFINITIVO", label: "Definitivo" },
  { value: "CONDICIONADO", label: "Condicionado" },
  { value: "PROVISORIO", label: "Provisório" },
  { value: "PENDENTE_REVISAO", label: "Pendente revisão" },
];

const formatAlvaraKindLabel = (value) =>
  ALVARA_FUNCIONAMENTO_KIND_OPTIONS.find((item) => item.value === value)?.label || "Pendente revisão";

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
  { value: "OK_DEFINITIVE", label: "OK - Definitivo" },
  { value: "DEFINITIVE_INVALIDATED", label: "Definitivo invalidado" },
  { value: "NO_CNAE", label: "Sem CNAE" },
  { value: "UNMAPPED_CNAE", label: "CNAE não mapeado" },
  { value: "NO_LICENCE", label: "Sem licença datada" },
  { value: "__none__", label: "Sem score status" },
];

const normalizeScoreRisk = (value) => String(value || "").trim().toLowerCase();
const normalizeScoreStatus = (value) => String(value || "").trim().toUpperCase();
const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");

const formatScoreRiskLabel = (value) => {
  const key = normalizeScoreRisk(value);
  if (key === "high") return "Alto";
  if (key === "medium") return "Médio";
  if (key === "low") return "Baixo";
  return "—";
};

const formatScoreStatusLabel = (value) => {
  const key = normalizeScoreStatus(value);
  if (key === "OK") return "OK";
  if (key === "OK_DEFINITIVE") return "OK - Definitivo";
  if (key === "DEFINITIVE_INVALIDATED") return "Definitivo invalidado";
  if (key === "NO_CNAE") return "Sem CNAE";
  if (key === "UNMAPPED_CNAE") return "CNAE não mapeado";
  if (key === "NO_LICENCE") return "Sem licença datada";
  return "—";
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

const formatMatrixStatus = (item) => parseStatusParts(item).baseStatus || "Sem status";

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

const parseIsActiveFlag = (company) => {
  const raw = company?.is_active ?? company?.isActive;
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return null;
  if (["t", "true", "1", "yes", "y", "sim", "ativo", "ativa"].includes(key)) return true;
  if (["f", "false", "0", "no", "n", "nao", "não", "inativo", "inativa"].includes(key)) return false;
  return null;
};

const resolveCompanyCertBucket = (value) => {
  const key = getStatusKey(value || "");
  if (!key || key === "nao_possui") return "sem_certificado";
  if (key.includes("vencid")) return "vencido";
  if (key.includes("venc") || key.includes("alert")) return "vencendo";
  if (key.includes("valid") || key.includes("ok")) return "valido";
  return "sem_certificado";
};

function EditDrawer({ open, item, onClose, onSaved, enqueueToast }) {
  const [status, setStatus] = useState("possui");
  const [validade, setValidade] = useState("");
  const [alvaraKind, setAlvaraKind] = useState("PENDENTE_REVISAO");
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
    setAlvaraKind(item?.alvara_funcionamento_kind || "PENDENTE_REVISAO");
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
          alvara_funcionamento_kind: item.licence_field === "alvara_funcionamento" ? alvaraKind : null,
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
        {item?.licence_field === "alvara_funcionamento" ? (
          <div>
            <Label>Tipo do alvará</Label>
            <Select value={alvaraKind} onValueChange={setAlvaraKind}>
              <SelectTrigger aria-label="Tipo do alvará"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALVARA_FUNCIONAMENTO_KIND_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
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
            {item?.licence_field === "alvara_funcionamento" ? (
              <div><strong>Tipo do alvará:</strong> {formatAlvaraKindLabel(item?.alvara_funcionamento_kind)}</div>
            ) : null}
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
  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return "renovacoes";
    try {
      const stored = localStorage.getItem("licencas_active_view");
      return stored && ["renovacoes", "matriz", "tipos"].includes(stored) ? stored : "renovacoes";
    } catch {
      return "renovacoes";
    }
  });
  const [openRailMobile, setOpenRailMobile] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [matrixViewMode, setMatrixViewMode] = useState("table");
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
  const [railStatusFilter, setRailStatusFilter] = useState("ativas");
  const [railRiskFilters, setRailRiskFilters] = useState(["HIGH", "MEDIUM", "LOW", "UNMAPPED"]);
  const [railCertFilters, setRailCertFilters] = useState(["valido", "vencendo", "vencido", "sem_certificado"]);
  const [railMunicipioFilters, setRailMunicipioFilters] = useState([]);
  const [railUrgencyMin, setRailUrgencyMin] = useState(0);
  const [railUrgencyMax, setRailUrgencyMax] = useState(100);
  const fileInputRef = useRef(null);
  const appendUploadSelectionRef = useRef(false);

  // Persistir estado da aba no localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem("licencas_active_view", view);
    } catch {
      // Silenciosamente ignorar erros de localStorage
    }
  }, [view]);

  React.useEffect(() => {
    const preset = panelPreset?.preset;
    if (!preset || panelPreset?.tab !== "licencas") return;
    setView("renovacoes");
    setSearchTerm("");
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
        const scoreUrgencia = Number.isFinite(Number(scoreUrgenciaRaw)) ? Math.max(0, Math.min(100, Number(scoreUrgenciaRaw))): null;
        const scoreRisk = normalizeScoreRisk(
          companySnapshot?.risco_consolidado ?? companySnapshot?.riscoConsolidado,
        );
        const scoreStatus = normalizeScoreStatus(
          companySnapshot?.score_status ?? companySnapshot?.scoreStatus,
        );
        const companyActive = parseIsActiveFlag(companySnapshot);
        const certBucket = resolveCompanyCertBucket(companySnapshot?.certificado);
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
          risk_bucket: scoreRisk === "HIGH" || scoreRisk === "MEDIUM" || scoreRisk === "LOW" ? scoreRisk : "UNMAPPED",
          cert_bucket: certBucket,
          company_active: companyActive,
        };
      }),
    [base, empresas],
  );

  const municipios = useMemo(() => ["todos", ...Array.from(new Set(rows.map((r) => r?.municipio).filter(Boolean)))], [rows]);
  const railMunicipioOptions = useMemo(
    () => Array.from(new Set(rows.map((item) => item?.municipio).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows],
  );

  const filteredBase = useMemo(
    () =>
      rows.filter((item) => {
        if (railStatusFilter === "ativas" && item?.company_active === false) return false;
        if (railStatusFilter === "inativas" && item?.company_active !== false) return false;
        if (!railRiskFilters.includes(item?.risk_bucket || "UNMAPPED")) return false;
        if (!railCertFilters.includes(item?.cert_bucket || "sem_certificado")) return false;
        if (railMunicipioFilters.length > 0 && !railMunicipioFilters.includes(item?.municipio)) return false;
        if (Number.isFinite(item?.score_urgencia)) {
          if (item.score_urgencia < railUrgencyMin || item.score_urgencia > railUrgencyMax) return false;
        } else if (railUrgencyMin > 0 || railUrgencyMax < 100) {
          return false;
        }

        if (searchTerm.trim()) {
          const token = searchTerm.trim().toLowerCase();
          const haystack = [
            item?.empresa_display,
            item?.cnpj,
            item?.municipio,
            resolveLicencaTipo(item?.tipo).label,
            formatStatusWithDate(item),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(token)) return false;
        }
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
      railCertFilters,
      railMunicipioFilters,
      railRiskFilters,
      railStatusFilter,
      railUrgencyMax,
      railUrgencyMin,
      rows,
      searchTerm,
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

  const renovacoesNotificacaoCount = useMemo(() => {
    let count = 0;
    grouped.forEach((items) => {
      count += items.length;
    });
    return count;
  }, [grouped]);

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

  const heroKpis = useMemo(() => {
    const total = filteredBase.length;
    const vencidas = filteredBase.filter((item) => item?.criticidade === "vencido").length;
    const vencendo = filteredBase.filter((item) => {
      const dias = Number(item?.dias_para_vencer);
      return Number.isFinite(dias) && dias >= 0 && dias <= 30;
    }).length;
    const pendentes = filteredBase.filter((item) => {
      const key = String(item?.status_key_canonical || "").trim();
      return key.startsWith("aguardando_") || key === "em_analise" || key === "sujeito";
    }).length;
    return [
      {
        key: "total",
        label: "Total de registros",
        value: total,
        subtitle: `${filtered.length} em exibição`,
        icon: ScrollText,
        tone: "bg-slate-50 border-slate-200 text-slate-900",
      },
      {
        key: "vencidas",
        label: "Vencidas",
        value: vencidas,
        subtitle: "Ação imediata",
        icon: ShieldAlert,
        tone: "bg-rose-50 border-rose-200 text-rose-900",
      },
      {
        key: "vencendo",
        label: "Vencendo",
        value: vencendo,
        subtitle: "Próximos 30 dias",
        icon: Clock3,
        tone: "bg-amber-50 border-amber-200 text-amber-900",
      },
      {
        key: "pendentes",
        label: "Pendentes / Em andamento",
        value: pendentes,
        subtitle: "Requer acompanhamento",
        icon: ShieldCheck,
        tone: "bg-blue-50 border-blue-200 text-blue-900",
      },
    ];
  }, [filtered.length, filteredBase]);

  const matrizCards = useMemo(
    () =>
      empresasMatriz.map((empresa) => ({
        ...empresa,
        totalTipos: TIPOS.reduce((acc, tipo) => (empresa.byTipo[tipo.key] ? acc + 1 : acc), 0),
        vencidos: TIPOS.reduce((acc, tipo) => {
          const item = empresa.byTipo[tipo.key];
          return item?.criticidade === "vencido" ? acc + 1 : acc;
        }, 0),
      })),
    [empresasMatriz],
  );

  const activeFilterBadges = useMemo(() => {
    const badges = [];
    if (searchTerm.trim()) badges.push({ key: "q", label: `Busca: ${searchTerm.trim()}` });
    if (quickMunicipio !== "todos") badges.push({ key: "municipio", label: `Município: ${quickMunicipio}` });
    if (quickTipo !== "todos") badges.push({ key: "tipo", label: `Tipo: ${TIPOS.find((t) => t.key === quickTipo)?.label || quickTipo}` });
    if (quickStatus !== "todos") badges.push({ key: "status", label: `Status: ${formatStatusDisplay(quickStatus)}` });
    if (quickScoreRisk !== "todos") badges.push({ key: "risk", label: `Risco: ${SCORE_RISK_OPTIONS.find((opt) => opt.value === quickScoreRisk)?.label || quickScoreRisk}` });
    if (quickScoreStatus !== "todos") badges.push({ key: "scoreStatus", label: `Score status: ${SCORE_STATUS_OPTIONS.find((opt) => opt.value === quickScoreStatus)?.label || quickScoreStatus}` });
    if (priorityGroup !== "todos") badges.push({ key: "criticidade", label: `Criticidade: ${groupConfig.find((group) => group.key === priorityGroup)?.label || priorityGroup}` });
    if (somenteAlertasLocal) badges.push({ key: "alertas", label: "Somente alertas" });
    return badges;
  }, [
    priorityGroup,
    quickMunicipio,
    quickScoreRisk,
    quickScoreStatus,
    quickStatus,
    quickTipo,
    searchTerm,
    somenteAlertasLocal,
  ]);

  const railActiveCount = useMemo(() => {
    let count = 0;
    if (railStatusFilter !== "ativas") count += 1;
    if (railRiskFilters.length !== 4) count += 1;
    if (railCertFilters.length !== 4) count += 1;
    if (railMunicipioFilters.length > 0) count += 1;
    if (railUrgencyMin > 0 || railUrgencyMax < 100) count += 1;
    return count;
  }, [railCertFilters.length, railMunicipioFilters.length, railRiskFilters.length, railStatusFilter, railUrgencyMax, railUrgencyMin]);

  const toggleRailFilter = (setter, key) => {
    setter((current) => {
      const list = Array.isArray(current) ? current : [];
      return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
    });
  };

  const clearSharedRailFilters = () => {
    setRailStatusFilter("ativas");
    setRailRiskFilters(["HIGH", "MEDIUM", "LOW", "UNMAPPED"]);
    setRailCertFilters(["valido", "vencendo", "vencido", "sem_certificado"]);
    setRailMunicipioFilters([]);
    setRailUrgencyMin(0);
    setRailUrgencyMax(100);
  };

  const clearContextFilters = () => {
    setSearchTerm("");
    setQuickMunicipio("todos");
    setQuickTipo("todos");
    setQuickStatus("todos");
    setQuickScoreRisk("todos");
    setQuickScoreStatus("todos");
    setPriorityGroup("todos");
    setSomenteAlertasLocal(false);
  };

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

  const railChipClass = (active) =>
    [
      "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
      active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-white",
    ].join(" ");

  const rail = (
    <aside className="space-y-3 rounded-2xl border border-slate-300 bg-white p-3.5 shadow-sm xl:sticky xl:top-0 xl:self-start xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Contexto</p>
          <h3 className="text-sm font-semibold text-slate-900">Filtros persistentes</h3>
          <p className="text-xs text-slate-500">Registros no recorte: {filteredBase.length}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-center">
          <div className="text-sm font-semibold leading-4 text-blue-700">{railActiveCount}</div>
          <div className="mt-1 text-[11px] font-medium leading-3 text-blue-700">{railActiveCount === 1 ? "ativo" : "ativos"}</div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Filtros rápidos</p>
        <div className="flex flex-wrap gap-2">
          {kpis.map((item) => (
            <button key={item.key} type="button" onClick={() => setKpiFilter(item.key)} className={railChipClass(kpiFilter === item.key)}>
              {item.label} <span className="ml-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[11px]">{item.value}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPriorityGroup("todos")} className={railChipClass(priorityGroup === "todos")}>Todas criticidades</button>
          {groupConfig.map((cfg) => (
            <button key={cfg.key} type="button" onClick={() => setPriorityGroup(cfg.key)} className={railChipClass(priorityGroup === cfg.key)}>
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Status da empresa</p>
        <div className="flex flex-wrap gap-2">
          {["ativas", "inativas", "todas"].map((value) => (
            <button key={value} type="button" onClick={() => setRailStatusFilter(value)} className={railChipClass(railStatusFilter === value)}>
              {value === "ativas" ? "Ativas" : value === "inativas" ? "Inativas" : "Todas"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Risco CNAE</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setRailRiskFilters(["HIGH", "MEDIUM", "LOW", "UNMAPPED"])} className={railChipClass(railRiskFilters.length === 4)}>
            Todos
          </button>
          {[{ key: "HIGH", label: "Alto" }, { key: "MEDIUM", label: "Médio" }, { key: "LOW", label: "Baixo" }, { key: "UNMAPPED", label: "Sem mapeamento" }].map((option) => (
            <button key={option.key} type="button" onClick={() => toggleRailFilter(setRailRiskFilters, option.key)} className={railChipClass(railRiskFilters.includes(option.key))}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Certificado</p>
        <div className="flex flex-wrap gap-2">
          {[{ key: "valido", label: "Válido" }, { key: "vencendo", label: "Vencendo" }, { key: "vencido", label: "Vencido" }, { key: "sem_certificado", label: "Sem certificado" }].map((option) => (
            <button key={option.key} type="button" onClick={() => toggleRailFilter(setRailCertFilters, option.key)} className={railChipClass(railCertFilters.includes(option.key))}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Município</p>
        {railMunicipioOptions.length === 0 ? <p className="text-xs text-slate-500">Sem municípios no recorte atual.</p> : null}
        <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
          {railMunicipioOptions.map((item) => (
            <label key={item} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-700 hover:bg-white">
              <input type="checkbox" checked={railMunicipioFilters.includes(item)} onChange={() => toggleRailFilter(setRailMunicipioFilters, item)} />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Score de urgência</p>
        <div className="relative h-6">
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-100" />
          <div className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-300" style={{ left: `${railUrgencyMin}%`, width: `${Math.max(0, railUrgencyMax - railUrgencyMin)}%` }} />
          <input type="range" min={0} max={100} value={railUrgencyMin} onChange={(event) => setRailUrgencyMin(Math.min(Number(event.target.value), railUrgencyMax))} className="ec-urgency-range" aria-label="Score de urgência mínimo" />
          <input type="range" min={0} max={100} value={railUrgencyMax} onChange={(event) => setRailUrgencyMax(Math.max(Number(event.target.value), railUrgencyMin))} className="ec-urgency-range" aria-label="Score de urgência máximo" />
        </div>
        <div className="flex justify-between text-[11px] font-semibold text-slate-500"><span>{railUrgencyMin}</span><span>{railUrgencyMax}</span></div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={clearSharedRailFilters}>
          Limpar
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden xl:block">{rail}</div>
        <section className="space-y-3">
          <Card className="border-subtle bg-surface">
            <CardContent className="p-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {heroKpis.map((kpi) => {
                  const Icon = kpi.icon;
                  const iconTone =
                    kpi.key === "vencidas"
                      ? "border-rose-200 bg-rose-50 text-rose-600"
                      : kpi.key === "vencendo"
                        ? "border-amber-200 bg-amber-50 text-amber-600"
                        : kpi.key === "pendentes"
                          ? "border-blue-200 bg-blue-50 text-blue-600"
                          : "border-blue-200 bg-blue-50 text-blue-600";
                  const subtitleTone = kpi.key === "vencidas" ? "text-amber-600" : "text-slate-500";
                  return (
                    <div key={kpi.key} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
                          <p className="mt-2 text-2xl font-semibold leading-none">{kpi.value}</p>
                          <p className={cn("mt-2 text-xs", subtitleTone)}>{kpi.subtitle}</p>
                        </div>
                        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl border", iconTone)}>
                          <Icon className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeFilterBadges.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeFilterBadges.map((badge) => <span key={badge.key} className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700">{badge.label}</span>)}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-subtle bg-card">
            <CardContent className="space-y-3 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Grupo Matriz por empresa */}
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={view === "matriz" ? "default" : "ghost"} className={view === "matriz" ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"} onClick={() => setView("matriz")}>
                      Visão Geral
                    </Button>
                  </div>

                  <Button size="sm" variant={view === "tipos" ? "default" : "ghost"} className={view === "tipos" ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"} onClick={() => setView("tipos")}>
                    Por Tipo
                  </Button>

                  <div className="relative">
                    <Button size="sm" variant={view === "renovacoes" ? "default" : "ghost"} className={view === "renovacoes" ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"} onClick={() => setView("renovacoes")}>
                      Renovações
                    </Button>
                    {renovacoesNotificacaoCount > 0 && <span className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{renovacoesNotificacaoCount}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {view === "matriz" ? (
                    <div className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 p-1">
                      <button type="button" onClick={() => setMatrixViewMode("table")} className={`rounded-md p-2 transition ${matrixViewMode === "table" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`} title="Visualização em tabela"><Logs className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setMatrixViewMode("cards")} className={`rounded-md p-2 transition ${matrixViewMode === "cards" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`} title="Visualização em cards"><LayoutGrid className="h-4 w-4" /></button>
                    </div>
                  ) : null}
                  <Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 xl:hidden" onClick={() => setOpenRailMobile(true)}>
                    <SlidersHorizontal className="mr-1 h-3.5 w-3.5" /> Filtros avançados
                  </Button>
                  {canManageLicencas && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" data-testid="licencas-upload-action" disabled={uploading || scanRunning}>
                          {uploading ? "Enviando..." : (scanRunning ? "Escaneando..." : "Atualizar licenças")}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={triggerUpload} data-testid="licencas-action-new"><FileDown className="mr-2 h-4 w-4" />Nova Licença</DropdownMenuItem>
                        <DropdownMenuItem onClick={triggerScanFull} data-testid="licencas-action-scan-full"><BookDown className="mr-2 h-4 w-4" />Scan completo</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
                <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por empresa, CNPJ, tipo ou município" className="h-9 border-slate-200 bg-slate-50 xl:col-span-2" />
                <Select value={quickMunicipio} onValueChange={setQuickMunicipio}>
                  <SelectTrigger className="h-9 border-slate-200 bg-slate-50"><MapPin className="h-4 w-4 text-slate-500" /><SelectValue placeholder="Município" /></SelectTrigger>
                  <SelectContent>{municipios.map((m) => <SelectItem key={m} value={m}>{m === "todos" ? "Todos municípios" : m}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={quickTipo} onValueChange={setQuickTipo}>
                  <SelectTrigger className="h-9 border-slate-200 bg-slate-50"><FileMinus className="h-4 w-4 text-slate-500" /><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent><SelectItem value="todos">Todos tipos</SelectItem>{TIPOS.map((tipo) => <SelectItem key={tipo.key} value={tipo.key}>{tipo.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={quickStatus} onValueChange={setQuickStatus}>
                  <SelectTrigger className="h-9 border-slate-200 bg-slate-50"><Clipboard className="h-4 w-4 text-slate-500" /><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent><SelectItem value="todos">Todos status</SelectItem>{STATUS_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{formatStatusDisplay(opt)}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={quickScoreRisk} onValueChange={setQuickScoreRisk}>
                  <SelectTrigger className="h-9 border-slate-200 bg-slate-50" data-testid="licencas-score-risk-filter"><ChartBarIncreasing className="h-4 w-4 text-slate-500" /><SelectValue placeholder="Risco score" /></SelectTrigger>
                  <SelectContent>{SCORE_RISK_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={quickScoreStatus} onValueChange={setQuickScoreStatus}>
                  <SelectTrigger className="h-9 border-slate-200 bg-slate-50" data-testid="licencas-score-status-filter"><SelectValue placeholder="Status do score" /></SelectTrigger>
                  <SelectContent>{SCORE_STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant={somenteAlertasLocal ? "default" : "outline"} className={somenteAlertasLocal ? "bg-slate-900 text-white hover:bg-slate-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"} onClick={() => setSomenteAlertasLocal((value) => !value)}><AlertTriangle className="mr-1 h-3.5 w-3.5" />Somente alertas</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"><ArrowUpDown className="mr-1 h-3.5 w-3.5" />{SORT_OPTIONS.find((item) => item.value === sortField)?.label || "Score"}<span className="ml-1 text-xs text-blue-700">{sortDir === "asc" ? "↑" : "↓"}</span><ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64 p-2">
                      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ordenar por</p>
                      <div className="space-y-1">
                        {SORT_OPTIONS.map((option) => {
                          const isActive = sortField === option.value;
                          return <button key={option.value} type="button" onClick={() => { if (isActive) { setSortDir((prev) => (prev === "asc" ? "desc" : "asc")); } else { setSortField(option.value); setSortDir(option.defaultDir); } }} className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm ${isActive ? "bg-slate-100 text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}><span>{option.label}</span><span className="text-xs text-slate-500">{isActive ? (sortDir === "asc" ? "Crescente" : "Decrescente") : ""}</span></button>;
                        })}
                      </div>
                      <div className="mt-2 border-t border-slate-200 pt-2"><Button size="sm" variant="outline" className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}>Direção: {sortDir === "asc" ? "Crescente" : "Decrescente"}</Button></div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Select value={priorityGroup} onValueChange={setPriorityGroup}><SelectTrigger className="h-9 w-[220px] border-slate-200 bg-slate-50"><SelectValue placeholder="Criticidade" /></SelectTrigger><SelectContent><SelectItem value="todos">Todas criticidades</SelectItem>{groupConfig.map((cfg) => <SelectItem key={cfg.key} value={cfg.key}>{cfg.label}</SelectItem>)}</SelectContent></Select>
                  <Button type="button" size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={clearContextFilters}>Limpar filtros da aba</Button>
                </div>
                <span className="text-sm text-slate-500">{sortedFiltered.length} registros exibidos</span>
              </div>

              <input ref={fileInputRef} className="hidden" type="file" multiple accept=".pdf,.jpg,.png" onChange={onSelectFiles} />
            </CardContent>
          </Card>

          {view === "renovacoes" && (
            <div className="space-y-3">
              {groupConfig.map((cfg) => {
                const list = grouped.get(cfg.key) || [];
                return (
                  <Card key={cfg.key} className="overflow-hidden border-subtle bg-card">
                    <CardHeader className={`pb-2 ${cfg.variant === "danger" ? "bg-rose-50/60" : "bg-amber-50/60"}`}><CardTitle className="flex items-center gap-2 text-base">{cfg.label}<span className="inline-flex min-w-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">{list.length}</span></CardTitle></CardHeader>
                    <CardContent className="space-y-2 p-3">
                      {list.length === 0 && <p className="text-sm text-slate-500">Sem itens neste grupo.</p>}
                      {list.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <CopyableCompanyName value={item.empresa_display} onCopy={handleCopy} size="base" />
                                {item.sem_vinculo ? <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">Sem vínculo</span> : null}
                                <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">{resolveLicencaTipo(item.tipo).label}</span>
                                {item?.licence_field === "alvara_funcionamento" ? (
                                  <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                    {formatAlvaraKindLabel(item?.alvara_funcionamento_kind)}
                                  </span>
                                ) : null}
                                <StatusBadge status={formatStatusWithDate(item)} />
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1" data-testid="licencas-score-urgencia">Score: {Number.isFinite(item?.score_urgencia) ? item.score_urgencia : "—"} <ScoreLegendInfo /></span>
                                <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1" data-testid="licencas-score-risk">Risco: {formatScoreRiskLabel(item?.risco_consolidado)}</span>
                                <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1" data-testid="licencas-score-status">Status score: {formatScoreStatusLabel(item?.score_status)}</span>
                                <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1">Município: {item?.municipio || "—"}</span>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={() => setDrawerItem(item)}>Detalhes</Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50">Ações <ChevronDown className="ml-1 h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56"><DropdownMenuItem onClick={() => enqueueToast?.("Processo iniciado (atalho).")}>Iniciar processo</DropdownMenuItem><DropdownMenuItem onClick={() => enqueueToast?.("Contato registrado (atalho).")}>Registrar contato</DropdownMenuItem>{item?.cnpj && handleCopy ? <DropdownMenuItem onClick={() => handleCopy(item.cnpj, `CNPJ copiado: ${item.cnpj}`)}>Copiar CNPJ</DropdownMenuItem> : null}</DropdownMenuContent>
                              </DropdownMenu>
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
            matrixViewMode === "table" ? (
              <Card className="ec-licence-matrix-card">
                <CardContent className="p-5">
                  <div className="ec-licence-matrix-head">
                    <small>Matriz</small>
                    <h3>Licenças por empresa</h3>
                  </div>
                  <div className="ec-licence-matrix-wrap">
                    <ScrollArea className="h-[calc(100dvh-24rem)] w-full">
                      <table className="ec-licence-matrix-table">
                        <thead className="sticky top-0 z-10 bg-white">
                          <tr>
                            <th>Empresa</th>
                            <th>Município</th>
                            {MATRIX_TIPOS.map((tipo) => <th key={tipo.key}>{tipo.label}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {empresasMatriz.map((emp) => (
                            <tr key={emp.key}>
                              <td className="ec-licence-matrix-company">
                                <div className="flex items-center gap-2">
                                  <span>{emp.empresa}</span>
                                  {emp.sem_vinculo ? <span className="ec-licence-matrix-tag">Sem vínculo</span> : null}
                                </div>
                              </td>
                              <td>{emp.municipio || "—"}</td>
                              {MATRIX_TIPOS.map((tipo) => {
                                const cell = emp.byTipo[tipo.key];
                                return (
                                  <td key={`${emp.key}-${tipo.key}`}>
                                    {cell ? (
                                      <button
                                        type="button"
                                        className="ec-licence-matrix-status"
                                        onClick={() => setDrawerItem(cell)}
                                      >
                                        <StatusBadge status={formatMatrixStatus(cell)} className="ec-chip-square" />
                                      </button>
                                    ) : (
                                      <span className="ec-licence-matrix-empty">Sem vínculo</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {matrizCards.map((empresa) => (
                  <Card key={empresa.key} className="overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md">
                    <CardContent className="space-y-3 p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-900">{empresa.empresa}</p>{empresa.sem_vinculo ? <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">Sem vínculo</span> : null}</div>
                        <p className="text-xs text-slate-500">{empresa.cnpj || "—"} {empresa.municipio ? `• ${empresa.municipio}` : ""}</p>
                      </div>
                      <div className="grid gap-2">
                        {TIPOS.map((tipo) => {
                          const item = empresa.byTipo[tipo.key];
                          return (
                            <button key={`${empresa.key}-${tipo.key}`} type="button" className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-left transition hover:border-slate-300 hover:bg-white" onClick={() => item ? setDrawerItem(item) : enqueueToast?.("Sem registro para edição neste tipo.")}>
                              <span className="text-xs font-medium text-slate-600">{tipo.label}</span>
                              {item ? <StatusBadge status={formatStatusWithDate(item)} /> : <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">Sem vínculo</span>}
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}

          {view === "tipos" && (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-5">
                {kpis.map((kpi) => (
                  <button key={kpi.key} type="button" onClick={() => setKpiFilter((current) => (current === kpi.key ? "todos" : kpi.key))} className={`rounded-xl border p-3 text-left transition ${kpiFilter === kpi.key ? "border-slate-400 bg-slate-100 text-slate-900" : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"}`}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</div><div className="mt-1 text-2xl font-semibold">{kpi.value}</div>
                  </button>
                ))}
              </div>
              <Card className="overflow-hidden border-subtle bg-card">
                <CardHeader><CardTitle>Tabela por tipo</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[560px]">
                    <Table>
                      <TableHeader className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur"><TableRow><TableHead>Empresa</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Vencimento</TableHead><TableHead>Município</TableHead><TableHead>Score</TableHead><TableHead>Risco</TableHead><TableHead>Status score</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {sortedFiltered.map((item, idx) => (
                          <TableRow key={`${item.id}-${idx}`}>
                            <TableCell><div className="flex items-center gap-2"><CopyableCompanyName value={item.empresa_display} onCopy={handleCopy} size="base" />{item.sem_vinculo ? <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">Sem vínculo</span> : null}</div></TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">{resolveLicencaTipo(item.tipo).label}</span>
                                {item?.licence_field === "alvara_funcionamento" ? (
                                  <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                    {formatAlvaraKindLabel(item?.alvara_funcionamento_kind)}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell><StatusBadge status={item.status_label} /></TableCell>
                            <TableCell>{item.validade_br_display || "—"}</TableCell>
                            <TableCell>{item.municipio || "—"}</TableCell>
                            <TableCell>{Number.isFinite(item?.score_urgencia) ? item.score_urgencia : "—"}</TableCell>
                            <TableCell><span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700" data-testid="licencas-score-risk">{formatScoreRiskLabel(item?.risco_consolidado)}</span></TableCell>
                            <TableCell><span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700" data-testid="licencas-score-status">{formatScoreStatusLabel(item?.score_status)}</span></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </section>
      </div>


      <SideDrawer
        open={openRailMobile}
        onClose={() => setOpenRailMobile(false)}
        subtitle="Licenças"
        title="Rail de filtros"
      >
        {rail}
      </SideDrawer>

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





