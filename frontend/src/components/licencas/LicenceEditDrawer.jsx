import React from "react";
import { Award, Building2, CalendarDays, FileText, MapPin, ScrollText } from "lucide-react";
import OverlayModal from "@/components/ui/OverlayModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const LABELS = {
  modalTitle: "Edição rápida de licença",
  modalHint: "Atualize a certidão operacional sem sair da visão geral.",
  certificateTitle: "Certidão operacional",
  mainData: "Dados principais",
  status: "Status",
  dueDate: "Vencimento",
  permitType: "Tipo do alvará",
  exceptionData: "Base de dispensa",
  reason: "Motivo padrão",
  justification: "Justificativa/Base",
  operationalNotes: "Registro operacional",
  notes: "Observação",
  owner: "Responsável",
  nextAction: "Próxima ação",
  onDemandDetails: "Detalhes sob demanda",
  rawStatus: "Status bruto",
  licenceType: "Tipo",
  city: "Município",
  companyDoc: "CNPJ",
  save: "Salvar",
  saving: "Salvando...",
  cancel: "Cancelar",
  saveNote: "A atualização é aplicada somente a este item de licença.",
  missingReference: "Registro sem referência de edição.",
  requiredException: "Informe motivo e justificativa para Não exigido.",
  saved: "Licença atualizada.",
  saveError: "Falha ao atualizar licença.",
  noDate: "Sem data definida",
  noInfo: "Não informado",
  definitiveReview: "Pendente de revisão",
};

const surfaceInputClassName = "border-slate-200 bg-white/90 shadow-none focus-visible:ring-blue-200";
const sectionClassName = "rounded-[24px] border border-slate-200 bg-white/80 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]";

function resolveStatusAppearance(status, getStatusKey, formatStatusDisplay) {
  const key = String(getStatusKey(status) || status || "").trim().toLowerCase();
  if (key.includes("vencid")) {
    return {
      label: formatStatusDisplay(status),
      chipClass: "border-rose-200 bg-rose-50 text-rose-700",
      accentClass: "from-rose-100 via-white to-amber-50",
      iconClass: "border-rose-200 bg-rose-50 text-rose-600",
    };
  }
  if (key.includes("aguard") || key.includes("analise") || key.includes("sujeito")) {
    return {
      label: formatStatusDisplay(status),
      chipClass: "border-amber-200 bg-amber-50 text-amber-700",
      accentClass: "from-amber-100 via-white to-blue-50",
      iconClass: "border-amber-200 bg-amber-50 text-amber-600",
    };
  }
  if (key.includes("nao_exig")) {
    return {
      label: formatStatusDisplay(status),
      chipClass: "border-slate-200 bg-slate-100 text-slate-700",
      accentClass: "from-slate-100 via-white to-slate-50",
      iconClass: "border-slate-200 bg-slate-100 text-slate-600",
    };
  }
  return {
    label: formatStatusDisplay(status),
    chipClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    accentClass: "from-blue-100 via-white to-emerald-50",
    iconClass: "border-blue-200 bg-blue-50 text-blue-700",
  };
}

function SummaryItem({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="mt-1 text-sm font-medium leading-5 text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, description }) {
  return (
    <div className="mb-4 space-y-1">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description ? <p className="text-xs text-slate-500">{description}</p> : null}
    </div>
  );
}

export default function LicenceEditDrawer({
  open,
  item,
  onClose,
  onSaved,
  enqueueToast,
  fetchJson,
  getStatusKey,
  formatStatusDisplay,
  displayEmpresa,
  formatAlvaraKindLabel,
  statusOptions,
  alvaraFuncionamentoKindOptions,
  motivoOptions,
}) {
  const [status, setStatus] = React.useState("possui");
  const [validade, setValidade] = React.useState("");
  const [alvaraKind, setAlvaraKind] = React.useState("PENDENTE_REVISAO");
  const [motivo, setMotivo] = React.useState("");
  const [justificativa, setJustificativa] = React.useState("");
  const [observacao, setObservacao] = React.useState("");
  const [responsavel, setResponsavel] = React.useState("");
  const [proximaAcao, setProximaAcao] = React.useState("");
  const [saving, setSaving] = React.useState(false);

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
  }, [open, item, getStatusKey]);

  const statusAppearance = React.useMemo(
    () => resolveStatusAppearance(status, getStatusKey, formatStatusDisplay),
    [formatStatusDisplay, getStatusKey, status],
  );

  const handleSave = async () => {
    if (!item?.licence_id || !item?.licence_field) {
      enqueueToast?.(LABELS.missingReference);
      return;
    }
    if (status === "nao_exigido" && (!motivo || !justificativa.trim())) {
      enqueueToast?.(LABELS.requiredException);
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
      enqueueToast?.(LABELS.saved);
      await onSaved?.();
      onClose?.();
    } catch (error) {
      enqueueToast?.(error?.message || LABELS.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <OverlayModal
      open={open}
      onClose={onClose}
      className="max-w-5xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)]"
      bodyClassName="p-0"
      footerClassName="border-slate-200 bg-white/95 px-6 py-4 backdrop-blur"
      header={(
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">{displayEmpresa(item)}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{LABELS.modalTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">{LABELS.modalHint}</p>
        </div>
      )}
      footer={(
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">{LABELS.saveNote}</p>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={onClose}>
              {LABELS.cancel}
            </Button>
            <Button type="button" className="bg-slate-900 text-white hover:bg-slate-800" onClick={handleSave} disabled={saving}>
              {saving ? LABELS.saving : LABELS.save}
            </Button>
          </div>
        </div>
      )}
    >
      <div className="grid lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className={cn("relative overflow-hidden border-b border-slate-200 p-6 lg:border-b-0 lg:border-r", `bg-gradient-to-br ${statusAppearance.accentClass}`)}>
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/50 blur-2xl" />
          <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-blue-100/40 blur-2xl" />
          <div className="relative space-y-5">
            <div className="rounded-[26px] border border-white/80 bg-white/88 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">{LABELS.certificateTitle}</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{item?.tipo || "Licença"}</h3>
                </div>
                <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border shadow-sm", statusAppearance.iconClass)}>
                  <Award className="h-8 w-8" strokeWidth={1.8} />
                </div>
              </div>

              <div className={cn("mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold", statusAppearance.chipClass)}>
                {statusAppearance.label}
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                Ajuste o status, validade e observações deste documento mantendo um visual de certidão e leitura rápida.
              </p>
            </div>

            <div className="grid gap-3">
              <SummaryItem icon={Building2} label="Empresa" value={displayEmpresa(item) || LABELS.noInfo} />
              <SummaryItem icon={CalendarDays} label={LABELS.dueDate} value={validade || LABELS.noDate} />
              <SummaryItem icon={MapPin} label={LABELS.city} value={item?.municipio || LABELS.noInfo} />
              <SummaryItem
                icon={item?.licence_field === "alvara_funcionamento" ? ScrollText : FileText}
                label={item?.licence_field === "alvara_funcionamento" ? LABELS.permitType : LABELS.licenceType}
                value={
                  item?.licence_field === "alvara_funcionamento"
                    ? formatAlvaraKindLabel(alvaraKind || item?.alvara_funcionamento_kind) || LABELS.definitiveReview
                    : item?.tipo || LABELS.noInfo
                }
              />
            </div>
          </div>
        </aside>

        <div className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 lg:p-7">
          <div className="space-y-5">
            <section className={sectionClassName}>
              <SectionTitle title={LABELS.mainData} description="Campos centrais da licença para atualização rápida." />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{LABELS.status}</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className={surfaceInputClassName}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{formatStatusDisplay(opt)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{LABELS.dueDate}</Label>
                  <Input className={surfaceInputClassName} type="date" value={validade || ""} onChange={(e) => setValidade(e.target.value)} />
                </div>

                {item?.licence_field === "alvara_funcionamento" ? (
                  <div className="space-y-2 md:col-span-2">
                    <Label>{LABELS.permitType}</Label>
                    <Select value={alvaraKind} onValueChange={setAlvaraKind}>
                      <SelectTrigger className={surfaceInputClassName} aria-label={LABELS.permitType}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {alvaraFuncionamentoKindOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            </section>

            {status === "nao_exigido" ? (
              <section className={cn(sectionClassName, "border-amber-200 bg-amber-50/70")}>
                <SectionTitle title={LABELS.exceptionData} description="Preencha a base formal para registrar a dispensa." />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{LABELS.reason}</Label>
                    <Select value={motivo} onValueChange={setMotivo}>
                      <SelectTrigger className={cn(surfaceInputClassName, "bg-white")}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {motivoOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>{formatStatusDisplay(opt)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{LABELS.justification}</Label>
                    <Input className="border-amber-200 bg-white shadow-none focus-visible:ring-amber-200" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
                  </div>
                </div>
              </section>
            ) : null}

            <section className={sectionClassName}>
              <SectionTitle title={LABELS.operationalNotes} description="Observações úteis para acompanhamento interno." />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>{LABELS.notes}</Label>
                  <Textarea className={cn(surfaceInputClassName, "min-h-[132px]")} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{LABELS.owner}</Label>
                  <Input className={surfaceInputClassName} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{LABELS.nextAction}</Label>
                  <Input className={surfaceInputClassName} value={proximaAcao} onChange={(e) => setProximaAcao(e.target.value)} />
                </div>
              </div>
            </section>

            <details className="rounded-[22px] border border-slate-200 bg-white/80 px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800">
                {LABELS.onDemandDetails}
              </summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryItem icon={FileText} label={LABELS.rawStatus} value={item?.status || "—"} />
                <SummaryItem icon={ScrollText} label={LABELS.licenceType} value={item?.tipo || "—"} />
                {item?.licence_field === "alvara_funcionamento" ? (
                  <SummaryItem icon={ScrollText} label={LABELS.permitType} value={formatAlvaraKindLabel(item?.alvara_funcionamento_kind)} />
                ) : null}
                <SummaryItem icon={MapPin} label={LABELS.city} value={item?.municipio || "—"} />
                <SummaryItem icon={Building2} label={LABELS.companyDoc} value={item?.cnpj || "—"} />
              </div>
            </details>
          </div>
        </div>
      </div>
    </OverlayModal>
  );
}
