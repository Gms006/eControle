// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { Clock, KeyRound, LayoutGrid, Logs, Search, SearchX, ShieldAlert, ShieldCheck, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatCard from "@/components/common/StatCard";
import DomainSubnav from "@/components/navigation/DomainSubnav";
import { categorizeCertificadoSituacao, isCertificadoSituacaoAlert } from "@/lib/certificados";
import { formatCnpj, formatCpf, normalizeDocumentDigits, removeDiacritics } from "@/lib/text";
import type { AppTabKey } from "@/lib/theme";

type CertificadosScreenProps = {
  certificados: any[];
  modoFoco: boolean;
  matchesMunicipioFilter: (item: any) => boolean;
  matchesQuery: (values: any[], fieldMap?: Record<string, any[]>) => boolean;
  handleCopy: (value?: string, message?: string) => Promise<void> | void;
  panelPreset?: { id: number; tab: string; preset?: Record<string, any> | null } | null;
  activeTab?: AppTabKey;
  onTabChange?: (tab: AppTabKey) => void;
};

type ViewMode = "table" | "cards";
type SortDir = "asc" | "desc";
type StatusKey = "ok" | "warn" | "danger" | "neutral";
type SortKey = "company_name" | "status" | "not_after" | "not_before";

type CertRow = {
  id: string;
  companyName: string;
  documentMasked: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  documentType: string;
  source: any;
};

const STATUS_ORDER: Record<StatusKey, number> = { danger: 0, warn: 1, ok: 2, neutral: 3 };

const formatDateBr = (value: any) => {
  if (!value) return "—";
  const text = String(value).trim();
  if (!text) return "—";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return new Intl.DateTimeFormat("pt-BR").format(parsed);
};

const toTimestamp = (value: any) => {
  const text = String(value ?? "").trim();
  if (!text) return Number.NaN;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split("/").map(Number);
    return new Date(year, month - 1, day).getTime();
  }
  return new Date(text).getTime();
};

const normalizeKey = (value: any) => removeDiacritics(String(value ?? "")).toLowerCase().trim();

const getFormattedDocument = (cert: any) => {
  const masked = cert?.cnpj ?? cert?.cpf ?? cert?.document_masked ?? cert?.documentMasked ?? cert?.raw?.document_masked ?? cert?.raw?.document;
  const digits = normalizeDocumentDigits(cert?.document_unmasked ?? cert?.documentUnmasked ?? cert?.raw?.document_unmasked ?? cert?.document_digits ?? cert?.documentDigits ?? cert?.cnpj ?? cert?.cpf ?? masked);
  if (!digits) return "—";
  if (digits.length === 14) return formatCnpj(digits) || digits;
  if (digits.length === 11) return formatCpf(digits) || digits;
  return masked ? String(masked).trim() : digits;
};

const getStatusMeta = (rawStatus: any, daysLeft: any) => {
  const category = categorizeCertificadoSituacao(rawStatus);
  const normalized = normalizeKey(category || rawStatus);
  if (Number.isFinite(daysLeft)) {
    const days = Number(daysLeft);
    if (days < 0) return { key: "danger" as StatusKey, label: "Vencido" };
    if (days <= 30) return { key: "warn" as StatusKey, label: "Vencendo (30d)" };
    return { key: "ok" as StatusKey, label: "Válido" };
  }
  if (normalized.includes("vencid")) return { key: "danger" as StatusKey, label: "Vencido" };
  if (normalized.includes("vence") || normalized.includes("alert")) return { key: "warn" as StatusKey, label: "Vencendo (30d)" };
  if (normalized.includes("valid")) return { key: "ok" as StatusKey, label: "Válido" };
  return { key: "neutral" as StatusKey, label: String(rawStatus || "Sem status") };
};

function validityPercent(notBefore: string, notAfter: string): number {
  const start = toTimestamp(notBefore);
  const end = toTimestamp(notAfter);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(0, Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100)));
}

const statusClassName = (status: StatusKey) =>
  status === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
  status === "warn" ? "border-amber-200 bg-amber-50 text-amber-700" :
  status === "danger" ? "border-rose-200 bg-rose-50 text-rose-700" :
  "border-slate-200 bg-slate-50 text-slate-600";

export default function CertificadosScreen({ certificados, modoFoco, matchesMunicipioFilter, matchesQuery, panelPreset, activeTab = "certificados", onTabChange }: CertificadosScreenProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [issuerFilter, setIssuerFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [hideExpired, setHideExpired] = useState(true);

  const lista = useMemo(() => (Array.isArray(certificados) ? certificados : []), [certificados]);

  const base = useMemo(() => {
    const filtered = lista.filter((item) => {
      if (!matchesMunicipioFilter(item)) return false;
      return matchesQuery([item?.titular, item?.situacao, item?.validoDe, item?.validoAte, item?.empresa, item?.cnpj, item?.cpf, item?.municipio], { nome: [item?.titular, item?.empresa], cnpj: [item?.cnpj, item?.titular] });
    });
    return modoFoco ? filtered.filter((item) => isCertificadoSituacaoAlert(item?.situacao)) : filtered;
  }, [lista, matchesMunicipioFilter, matchesQuery, modoFoco]);

  const rows = useMemo<CertRow[]>(() => base.map((cert, index) => ({
    id: String(cert?.id ?? `${cert?.titular ?? "cert"}-${index}`),
    companyName: String(cert?.empresa ?? cert?.titular ?? "Sem empresa").trim() || "Sem empresa",
    documentMasked: getFormattedDocument(cert),
    issuer: String(cert?.issuer_cn ?? cert?.issuerCN ?? cert?.emissor ?? cert?.cert_authority ?? cert?.autoridade_certificadora ?? "Não informado").trim() || "Não informado",
    notBefore: formatDateBr(cert?.validoDe ?? cert?.not_before),
    notAfter: formatDateBr(cert?.validoAte ?? cert?.not_after),
    documentType: String(cert?.document_type ?? cert?.tipo_documento ?? "A1/A3").trim() || "A1/A3",
    source: cert,
  })), [base]);

  const issuerOptions = useMemo(() => ["all", ...new Set(rows.map((row) => row.issuer))], [rows]);

  const filteredRows = useMemo(() => {
    const q = normalizeKey(search);
    let list = rows.filter((row) => {
      const st = getStatusMeta(row.source?.situacao, row.source?.diasRestantes);
      if (q && ![row.companyName, row.documentMasked, row.issuer].some((v) => normalizeKey(v).includes(q))) return false;
      if (hideExpired && st.key === "danger") return false;
      if (statusFilter !== "all" && st.key !== statusFilter) return false;
      if (issuerFilter !== "all" && row.issuer !== issuerFilter) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const statusA = getStatusMeta(a.source?.situacao, a.source?.diasRestantes);
      const statusB = getStatusMeta(b.source?.situacao, b.source?.diasRestantes);
      let cmp = 0;
      if (sortBy === "company_name") cmp = a.companyName.localeCompare(b.companyName, "pt-BR", { sensitivity: "base" });
      else if (sortBy === "status") cmp = (STATUS_ORDER[statusA.key] ?? 9) - (STATUS_ORDER[statusB.key] ?? 9);
      else if (sortBy === "not_after") cmp = toTimestamp(a.notAfter) - toTimestamp(b.notAfter);
      else if (sortBy === "not_before") cmp = toTimestamp(a.notBefore) - toTimestamp(b.notBefore);
      if (!Number.isFinite(cmp)) cmp = 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, search, hideExpired, statusFilter, issuerFilter, sortBy, sortDir]);

  const stats = useMemo(() => {
    const statuses = filteredRows.map((row) => getStatusMeta(row.source?.situacao, row.source?.diasRestantes).key);
    return { total: rows.length, validos: statuses.filter((k) => k === "ok").length, vencendo: statuses.filter((k) => k === "warn").length, vencidos: statuses.filter((k) => k === "danger").length };
  }, [filteredRows, rows.length]);

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (search.trim()) chips.push(`Busca: ${search.trim()}`);
    if (statusFilter !== "all") chips.push(`Status: ${statusFilter === "ok" ? "Válido" : statusFilter === "warn" ? "Vencendo" : "Vencido"}`);
    if (issuerFilter !== "all") chips.push(`Emissor: ${issuerFilter}`);
    if (hideExpired) chips.push("Ocultar vencidos");
    if (sortBy !== "status" || sortDir !== "asc") chips.push(`Ordenação: ${sortBy} (${sortDir.toUpperCase()})`);
    if (viewMode === "cards") chips.push("Visualização: Cards");
    return chips;
  }, [search, statusFilter, issuerFilter, hideExpired, sortBy, sortDir, viewMode]);

  useEffect(() => {
    const preset = panelPreset?.preset;
    if (!preset || panelPreset?.tab !== "certificados") return;
    setViewMode("table");
  }, [panelPreset]);

  return (
    <div className="space-y-4">
      <DomainSubnav activeTab={activeTab} onTabChange={onTabChange} />

      <div className="flex flex-wrap gap-2">
        {activeFilterChips.map((chip) => <span key={chip} className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">{chip}</span>)}
        {activeFilterChips.length === 0 ? <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">Sem filtros adicionais ativos</span> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de certificados" value={stats.total} icon={<KeyRound className="h-5 w-5" />} accentClassName="bg-blue-500" />
        <StatCard label="Válidos" value={stats.validos} icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />} accentClassName="bg-emerald-500" />
        <StatCard label="Vencendo (30d)" value={stats.vencendo} icon={<Clock className="h-5 w-5 text-amber-600" />} accentClassName="bg-amber-500" hint="Renovar em breve" />
        <StatCard label="Vencidos" value={stats.vencidos} icon={<ShieldAlert className="h-5 w-5 text-rose-600" />} accentClassName="bg-rose-500" hint="Ação imediata" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="overflow-x-auto">
          <div className="flex min-w-max flex-nowrap items-center gap-2">
            <div className="relative w-[300px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por empresa, CNPJ, emissor" className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-300 focus:bg-white" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-[140px] rounded-lg border-slate-200 bg-white text-sm"><Filter className="h-4 w-4 opacity-50"/><SelectValue placeholder="Status"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status</SelectItem>
                <SelectItem value="ok">Válido</SelectItem>
                <SelectItem value="warn">Vencendo (30d)</SelectItem>
                <SelectItem value="danger">Vencido</SelectItem>
              </SelectContent>
            </Select>
            <Select value={issuerFilter} onValueChange={setIssuerFilter}>
              <SelectTrigger className="h-10 w-[140px] rounded-lg border-slate-200 bg-white text-sm"><Filter className="h-4 w-4 opacity-50"/><SelectValue placeholder="Emissor" /></SelectTrigger>
              <SelectContent>
                {issuerOptions.map((issuer) => <SelectItem key={issuer} value={issuer}>{issuer === "all" ? "Emissor" : issuer}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={hideExpired}
                onChange={(event) => setHideExpired(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Ocultar vencidos
            </label>
            <div className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-2 py-1">
              <button type="button" onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">↕ <span>{sortBy === "status" ? "Status (urgência)" : sortBy === "company_name" ? "Empresa" : sortBy === "not_after" ? "Válido até" : "Válido desde"}</span></button>
              <Select value={sortBy} onValueChange={(v: SortKey) => setSortBy(v)}>
                <SelectTrigger className="ml-2 h-8 w-0 border-0 p-0 text-transparent shadow-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Status (urgência)</SelectItem>
                  <SelectItem value="company_name">Empresa</SelectItem>
                  <SelectItem value="not_after">Válido até</SelectItem>
                  <SelectItem value="not_before">Válido desde</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto inline-flex items-center gap-2 pl-2">
              <span className="text-sm text-slate-600">{filteredRows.length} resultados</span>
              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1">
                <button type="button" onClick={() => setViewMode("table")} className={`rounded-md p-2 transition ${viewMode === "table" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}><Logs className="h-4 w-4" /></button>
                <button type="button" onClick={() => setViewMode("cards")} className={`rounded-md p-2 transition ${viewMode === "cards" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}><LayoutGrid className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><SearchX className="h-5 w-5" />Nenhum certificado encontrado.</CardContent></Card>
      ) : viewMode === "table" ? (
        <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[980px] border-collapse"><thead className="bg-slate-50"><tr><th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Empresa</th><th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">CNPJ</th><th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Emissor</th><th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Válido desde</th><th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Válido até</th><th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Status</th></tr></thead><tbody>{filteredRows.map((row) => { const st = getStatusMeta(row.source?.situacao, row.source?.diasRestantes); return (<tr key={row.id} className="hover:bg-slate-50/70"><td className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">{row.companyName}</td><td className="border-b border-slate-200 px-4 py-3 text-xs font-mono text-slate-700">{row.documentMasked}</td><td className="border-b border-slate-200 px-4 py-3 text-xs text-slate-700">{row.issuer}</td><td className="border-b border-slate-200 px-4 py-3 text-xs font-mono text-slate-700">{row.notBefore}</td><td className="border-b border-slate-200 px-4 py-3 text-xs font-mono text-slate-700">{row.notAfter}</td><td className="border-b border-slate-200 px-4 py-3"><span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${statusClassName(st.key)}`}>{st.label}</span></td></tr>); })}</tbody></table></div></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredRows.map((row) => { const st = getStatusMeta(row.source?.situacao, row.source?.diasRestantes); const pct = validityPercent(row.notBefore, row.notAfter); const barColor = st.key === "ok" ? "bg-emerald-500" : st.key === "warn" ? "bg-amber-500" : "bg-rose-500"; const iconBg = st.key === "ok" ? "bg-emerald-50 text-emerald-600" : st.key === "warn" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"; const Icon = st.key === "ok" ? ShieldCheck : st.key === "warn" ? Clock : ShieldAlert; return (<Card key={row.id} className="border-slate-200/80 bg-white shadow-sm transition hover:shadow-md"><CardContent className="p-3.5"><div className="flex items-start gap-2.5"><div className={`grid h-9 w-9 place-items-center rounded-xl ${iconBg}`}><Icon className="h-4.5 w-4.5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{row.companyName}</p><p className="mt-0.5 text-xs text-slate-500">{row.documentMasked}</p></div><span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium ${statusClassName(st.key)}`}>{st.label}</span></div><div className="mt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Período de validade</p><div className="mt-1 flex items-center justify-between text-[11px] text-slate-500"><span className="font-mono">{row.notBefore}</span><span className="font-mono">{row.notAfter}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} /></div></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Emissor</p><p className="mt-1 truncate text-xs font-medium text-slate-700">{row.issuer}</p></div><div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tipo documento</p><p className="mt-1 truncate text-xs font-medium text-slate-700">{row.documentType}</p></div></div></CardContent></Card>); })}</div>
      )}
    </div>
  );
}
