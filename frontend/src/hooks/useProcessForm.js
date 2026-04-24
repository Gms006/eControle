import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatMunicipioDisplay, normalizeMunicipio } from "@/lib/normalization";
import { toCanonicalIsoDate } from "@/lib/date";
import {
  deriveStatusFromInstallment,
  formatInstallment,
  normalizeInstallmentInput,
  parseInstallment,
  validateInstallmentInput,
} from "@/lib/installment";
import { formatStatusDisplay } from "@/lib/status";
import { normalizeDigits } from "@/lib/masks";

export const EMPTY_PROCESS_FORM = {
  company_id: "",
  empresa_nao_cadastrada: false,
  company_cnpj: "",
  company_razao_social: "",
  process_type: "DIVERSOS",
  protocolo: "",
  municipio: "",
  data_solicitacao: "",
  situacao: "",
  obs: "",
  extra: {},
};

const PROCESS_SITUACAO_LABELS = {
  pendente: "Pendente",
  em_analise: "Em análise",
  em_andamento: "Em andamento",
  aguardando_documento: "Aguardando documento",
  aguardando_vistoria: "Aguardando vistoria",
  aguardando_pagamento: "Aguardando pagamento",
  aguardando_regularizacao: "Aguardando regularização",
  aguardando_liberacao: "Aguardando liberação",
  concluido: "Concluído",
  licenciado: "Licenciado",
  notificacao: "Notificação",
  indeferido: "Indeferido",
  cancelado: "Cancelado",
};

const DEFAULT_DIVERSOS_OPERACOES = [
  { value: "inscricao", label: "Inscrição" },
  { value: "restituicao", label: "Restituição" },
  { value: "abertura", label: "Abertura" },
  { value: "renovacao", label: "Renovação" },
  { value: "alteracao", label: "Alteração" },
  { value: "baixa", label: "Baixa" },
  { value: "cancel_de_tributos", label: "Cancelamento de Tributos" },
  { value: "retificacao", label: "Retificação" },
];

const DEFAULT_ORGAOS_OPTIONS = [
  { value: "prefeitura", label: "Prefeitura" },
  { value: "bombeiros", label: "Bombeiros" },
  { value: "vigilancia_sanitaria", label: "Vigilância Sanitária" },
];

const DEFAULT_ALVARA_OPTIONS = [
  { value: "sujeito", label: "Sujeito" },
  { value: "isento", label: "Isento" },
  { value: "nao_possui", label: "Não possui" },
];

const DEFAULT_SANITARIO_SERVICOS = [
  { value: "1o_alvara", label: "1º Alvará" },
  { value: "licenciamento", label: "Licenciamento" },
  { value: "renovacao", label: "Renovação" },
  { value: "vistoria", label: "Vistoria" },
];

const DEFAULT_SANITARIO_NOTIFICACOES = [
  { value: "sem_notificacao", label: "Sem Notificação" },
  { value: "notificado", label: "Notificado" },
  { value: "auto_infracao", label: "Auto de Infração" },
];

const DEFAULT_PROCESS_SITUACOES = Object.entries(PROCESS_SITUACAO_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const PROCESS_CERCON_TAX_FIELDS = [
  ["taxa_bombeiros_sync_status", "Taxa"],
  ["tpi_sync_status", "TPI"],
];

const PROCESS_CERCON_TAX_TO_COMPANY_TAX_FIELD = {
  taxa_bombeiros_sync_status: "taxa_bombeiros",
  tpi_sync_status: "tpi",
};

export const TAX_STATUS_OPTIONS = ["", "em_aberto", "parcelado", "pago", "isento", "nao_aplicavel", "pendente"];
export const TAX_STATUS_OPTION_ITEMS = TAX_STATUS_OPTIONS.map((value) => ({
  value,
  label: value ? formatStatusDisplay(value) : "—",
}));

const EMPTY_MODAL = { open: false, mode: "create", processId: null };

const PROCESS_TYPE_CANONICAL_MAP = {
  USO_SOLO: "USO_DO_SOLO",
  CERTIDAO_USO_SOLO: "USO_DO_SOLO",
  CERTIDAO_DE_USO_DO_SOLO: "USO_DO_SOLO",
  AMBIENTAL: "LICENCA_AMBIENTAL",
  LICENCA_AMBIENTE: "LICENCA_AMBIENTAL",
  ALVARA_VIG_SANITARIA: "ALVARA_SANITARIO",
};

const AMBIENTAL_OPERACOES_VALIDAS = new Set([
  "dispensa_ambiental",
  "licenca_ambiental",
]);

function normalizeProcessType(value) {
  const key = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  if (!key) return "DIVERSOS";
  return PROCESS_TYPE_CANONICAL_MAP[key] || key;
}

function normalizeEnumOptions(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item.value === "string" && typeof item.label === "string")
    .map((item) => ({ value: item.value, label: item.label }));
}

function promptPasswordForDelete() {
  const password = window.prompt("Confirme sua senha para prosseguir com a exclusão:");
  if (password === null) return null;
  const trimmed = String(password || "").trim();
  if (!trimmed) throw new Error("Senha obrigatória para confirmar a exclusão.");
  return trimmed;
}

export function useProcessForm({ apiJson, onRefresh }) {
  const [modal, setModal] = useState(EMPTY_MODAL);
  const [form, setForm] = useState(EMPTY_PROCESS_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [companyOptions, setCompanyOptions] = useState([]);
  const [processSituacoes, setProcessSituacoes] = useState(DEFAULT_PROCESS_SITUACOES);
  const [processOperacoes, setProcessOperacoes] = useState(DEFAULT_DIVERSOS_OPERACOES);
  const [processOrgaos, setProcessOrgaos] = useState(DEFAULT_ORGAOS_OPTIONS);
  const [processAlvaras, setProcessAlvaras] = useState(DEFAULT_ALVARA_OPTIONS);
  const [processServicos, setProcessServicos] = useState(DEFAULT_SANITARIO_SERVICOS);
  const [processNotificacoes, setProcessNotificacoes] = useState(DEFAULT_SANITARIO_NOTIFICACOES);

  const [cerconTaxStatusDraft, setCerconTaxStatusDraft] = useState({});
  const [cerconTaxInstallmentDraft, setCerconTaxInstallmentDraft] = useState({});
  const [cerconTaxInstallmentError, setCerconTaxInstallmentError] = useState({});
  const [cerconTaxPendingObservationDraft, setCerconTaxPendingObservationDraft] = useState({});
  const cerconCreateSeedRef = useRef("");

  const loadCompanyOptions = useCallback(async () => {
    const data = await apiJson("/api/v1/companies?limit=1000");
    setCompanyOptions(Array.isArray(data) ? data : []);
  }, [apiJson]);

  const fetchCompanyTaxByCompanyId = useCallback(
    async (companyId) => {
      if (!companyId) return null;
      const data = await apiJson("/api/v1/taxas?limit=1000");
      const list = Array.isArray(data) ? data : [];
      return list.find((item) => String(item?.company_id || item?.empresa_id || "") === String(companyId)) || null;
    },
    [apiJson],
  );

  const initializeCerconDraft = useCallback((extra = {}) => {
    const nextStatus = {};
    const nextInstallment = {};
    const nextPendingObs = {};

    PROCESS_CERCON_TAX_FIELDS.forEach(([field]) => {
      const raw = String(extra?.[field] || "").trim();
      const pendingObs = String(extra?.[`${field}_observacao_pendente`] || "").trim();
      const parsed = parseInstallment(raw);

      if (parsed) {
        const derived = deriveStatusFromInstallment(parsed.paid, parsed.total);
        nextStatus[field] = derived === "paid" ? "pago" : "parcelado";
        nextInstallment[field] = formatInstallment(parsed.paid, parsed.total);
      } else {
        nextStatus[field] = raw || "";
      }

      if (pendingObs) {
        nextPendingObs[field] = pendingObs;
      }
    });

    setCerconTaxStatusDraft(nextStatus);
    setCerconTaxInstallmentDraft(nextInstallment);
    setCerconTaxInstallmentError({});
    setCerconTaxPendingObservationDraft(nextPendingObs);
  }, []);

  const closeProcessModal = useCallback(() => {
    setModal(EMPTY_MODAL);
    cerconCreateSeedRef.current = "";
    setCerconTaxStatusDraft({});
    setCerconTaxInstallmentDraft({});
    setCerconTaxInstallmentError({});
    setCerconTaxPendingObservationDraft({});
  }, []);

  const updateExtra = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, extra: { ...(prev.extra || {}), [key]: value } }));
  }, []);

  const handleCerconTaxStatusChange = useCallback((field, value) => {
    setCerconTaxStatusDraft((prev) => ({ ...prev, [field]: value }));

    if (value !== "pendente") {
      setCerconTaxPendingObservationDraft((prev) => {
        const clone = { ...prev };
        delete clone[field];
        return clone;
      });
    }

    if (value === "parcelado") {
      setCerconTaxInstallmentDraft((prev) => ({ ...prev, [field]: prev[field] || "/" }));
      setCerconTaxInstallmentError((prev) => ({ ...prev, [field]: validateInstallmentInput("/") }));
    } else {
      setCerconTaxInstallmentDraft((prev) => {
        const clone = { ...prev };
        delete clone[field];
        return clone;
      });
      setCerconTaxInstallmentError((prev) => {
        const clone = { ...prev };
        delete clone[field];
        return clone;
      });
    }

    setForm((prev) => ({
      ...prev,
      extra: { ...(prev.extra || {}), [field]: value },
    }));
  }, []);

  const handleCerconTaxInstallmentChange = useCallback((field, value) => {
    const normalized = normalizeInstallmentInput(value);
    setCerconTaxInstallmentDraft((prev) => ({ ...prev, [field]: normalized }));
    setCerconTaxInstallmentError((prev) => ({
      ...prev,
      [field]: validateInstallmentInput(normalized),
    }));
  }, []);

  const handleCerconTaxPendingObservationChange = useCallback((field, value) => {
    setCerconTaxPendingObservationDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const openProcess = useCallback(
    async ({ mode = "create", processId = null }) => {
      await loadCompanyOptions();
      setModal({ open: true, mode, processId: processId || null });

      if (mode === "edit" && processId) {
        cerconCreateSeedRef.current = "";
        const data = await apiJson(`/api/v1/processos/${processId}`);
        const processType = normalizeProcessType(data?.process_type);
        let extra = data?.extra || {};

        if (processType === "CERCON" && data?.company_id) {
          const tax = await fetchCompanyTaxByCompanyId(data.company_id);
          if (tax) {
            const taxRaw = tax?.raw && typeof tax.raw === "object" ? tax.raw : {};
            extra = {
              ...extra,
              taxa_bombeiros_sync_status:
                tax?.taxa_bombeiros ?? tax?.bombeiros ?? extra?.taxa_bombeiros_sync_status ?? "",
              tpi_sync_status: tax?.tpi ?? extra?.tpi_sync_status ?? "",
              taxa_bombeiros_sync_status_observacao_pendente:
                taxRaw?.taxa_bombeiros_observacao_pendente ??
                extra?.taxa_bombeiros_sync_status_observacao_pendente ??
                "",
              tpi_sync_status_observacao_pendente:
                taxRaw?.tpi_observacao_pendente ?? extra?.tpi_sync_status_observacao_pendente ?? "",
            };
          }
        }

        setForm({
          ...EMPTY_PROCESS_FORM,
          company_id: data?.company_id || "",
          empresa_nao_cadastrada: data?.raw?.empresa_nao_cadastrada === true,
          company_cnpj: data?.raw?.company_cnpj || data?.raw?.cnpj || "",
          company_razao_social: data?.raw?.company_razao_social || data?.raw?.empresa || "",
          process_type: processType,
          protocolo: data?.protocolo || "",
          municipio: formatMunicipioDisplay(data?.municipio || ""),
          data_solicitacao: data?.data_solicitacao || "",
          situacao: data?.situacao || "",
          obs: data?.obs || "",
          extra,
        });

        if (processType === "CERCON") {
          initializeCerconDraft(extra);
        } else {
          initializeCerconDraft({});
        }
        return;
      }

      setForm(EMPTY_PROCESS_FORM);
      cerconCreateSeedRef.current = "";
      initializeCerconDraft({});
    },
    [apiJson, fetchCompanyTaxByCompanyId, initializeCerconDraft, loadCompanyOptions],
  );

  useEffect(() => {
    apiJson("/api/v1/meta/enums")
      .then((payload) => {
        const situacoesFromCanonical = normalizeEnumOptions(payload?.situacao_processos);
        const situacoesFromLegacy = normalizeEnumOptions(payload?.process_situacoes);
        const situacoes = situacoesFromCanonical.length > 0 ? situacoesFromCanonical : situacoesFromLegacy;
        setProcessSituacoes(situacoes.length > 0 ? situacoes : DEFAULT_PROCESS_SITUACOES);

        const operacoes = normalizeEnumOptions(payload?.operacoes_diversos);
        const orgaos = normalizeEnumOptions(payload?.orgaos_diversos);
        const alvaras = normalizeEnumOptions(payload?.alvaras_funcionamento);
        const servicos = normalizeEnumOptions(payload?.servicos_sanitarios);
        const notificacoes = normalizeEnumOptions(payload?.notificacoes_sanitarias);

        setProcessOperacoes(operacoes.length > 0 ? operacoes : DEFAULT_DIVERSOS_OPERACOES);
        setProcessOrgaos(orgaos.length > 0 ? orgaos : DEFAULT_ORGAOS_OPTIONS);
        setProcessAlvaras(alvaras.length > 0 ? alvaras : DEFAULT_ALVARA_OPTIONS);
        setProcessServicos(servicos.length > 0 ? servicos : DEFAULT_SANITARIO_SERVICOS);
        setProcessNotificacoes(notificacoes.length > 0 ? notificacoes : DEFAULT_SANITARIO_NOTIFICACOES);
      })
      .catch(() => {
        setProcessSituacoes(DEFAULT_PROCESS_SITUACOES);
        setProcessOperacoes(DEFAULT_DIVERSOS_OPERACOES);
        setProcessOrgaos(DEFAULT_ORGAOS_OPTIONS);
        setProcessAlvaras(DEFAULT_ALVARA_OPTIONS);
        setProcessServicos(DEFAULT_SANITARIO_SERVICOS);
        setProcessNotificacoes(DEFAULT_SANITARIO_NOTIFICACOES);
      });
  }, [apiJson]);

  useEffect(() => {
    if (!modal.open) return;
    if (modal.mode !== "create") return;
    if (form.process_type !== "CERCON") return;
    if (!form.company_id) return;
    const seedKey = `${form.company_id}:${form.process_type}:${modal.mode}:${modal.open ? "1" : "0"}`;
    if (cerconCreateSeedRef.current === seedKey) return;
    cerconCreateSeedRef.current = seedKey;

    let active = true;

    void (async () => {
      try {
        const tax = await fetchCompanyTaxByCompanyId(form.company_id);
        if (!active || !tax) return;

        const taxRaw = tax?.raw && typeof tax.raw === "object" ? tax.raw : {};
        const nextExtra = {
          ...(form.extra || {}),
          taxa_bombeiros_sync_status: tax?.taxa_bombeiros ?? tax?.bombeiros ?? "",
          tpi_sync_status: tax?.tpi ?? "",
          taxa_bombeiros_sync_status_observacao_pendente:
            taxRaw?.taxa_bombeiros_observacao_pendente ?? "",
          tpi_sync_status_observacao_pendente:
            taxRaw?.tpi_observacao_pendente ?? "",
        };

        setForm((prev) => {
          const currentExtra = prev.extra || {};
          const same =
            currentExtra.taxa_bombeiros_sync_status === nextExtra.taxa_bombeiros_sync_status &&
            currentExtra.tpi_sync_status === nextExtra.tpi_sync_status &&
            currentExtra.taxa_bombeiros_sync_status_observacao_pendente ===
              nextExtra.taxa_bombeiros_sync_status_observacao_pendente &&
            currentExtra.tpi_sync_status_observacao_pendente === nextExtra.tpi_sync_status_observacao_pendente;
          if (same) return prev;
          return { ...prev, extra: nextExtra };
        });
        initializeCerconDraft(nextExtra);
      } catch {
        cerconCreateSeedRef.current = "";
      }
    })();

    return () => {
      active = false;
    };
  }, [fetchCompanyTaxByCompanyId, form.company_id, form.process_type, initializeCerconDraft, modal.mode, modal.open]);

  const saveProcess = useCallback(async () => {
    setIsSaving(true);

    try {
      const isUnregistered = modal.mode === "create" && form.empresa_nao_cadastrada === true;

      if (!isUnregistered && !form.company_id && modal.mode === "create") {
        throw new Error("Selecione a empresa");
      }

      if (isUnregistered && form.process_type !== "DIVERSOS") {
        throw new Error("Empresa não cadastrada só é permitida para processos do tipo Diversos");
      }

      if (isUnregistered) {
        const cnpjDigits = normalizeDigits(form.company_cnpj);
        if (cnpjDigits.length !== 14) throw new Error("CNPJ da empresa não cadastrada inválido");
        if (!String(form.company_razao_social || "").trim()) {
          throw new Error("Razão Social da empresa não cadastrada é obrigatória");
        }
      }

      if (!form.protocolo?.trim()) {
        throw new Error("Protocolo obrigatório");
      }

      if (form.process_type === "LICENCA_AMBIENTAL") {
        const operacaoAmbiental = String(form.extra?.operacao || "").trim();
        if (!AMBIENTAL_OPERACOES_VALIDAS.has(operacaoAmbiental)) {
          throw new Error("Selecione uma operação ambiental válida.");
        }
      }

      const nextExtra = { ...(form.extra || {}) };
      const cerconTaxPatch = {};
      const cerconTaxRawPatch = {};

      if (form.process_type === "CERCON" && form.company_id) {
        for (const [field, label] of PROCESS_CERCON_TAX_FIELDS) {
          const mode = String(cerconTaxStatusDraft[field] ?? form.extra?.[field] ?? "").trim();
          const pendingObsKey = `${field}_observacao_pendente`;

          if (!mode) {
            nextExtra[field] = null;
            nextExtra[pendingObsKey] = null;
            cerconTaxPatch[field] = null;
            cerconTaxRawPatch[field] = null;
            continue;
          }

          if (mode === "pendente") {
            const note = String(cerconTaxPendingObservationDraft[field] || "").trim();
            nextExtra[pendingObsKey] = note || null;
            cerconTaxRawPatch[field] = note || null;
          } else {
            nextExtra[pendingObsKey] = null;
            cerconTaxRawPatch[field] = null;
          }

          if (mode !== "parcelado") {
            nextExtra[field] = mode;
            cerconTaxPatch[field] = mode;
            continue;
          }

          const installmentText = String(cerconTaxInstallmentDraft[field] ?? "").trim();
          const installmentError = validateInstallmentInput(installmentText);
          if (installmentError) {
            throw new Error(`${label}: ${installmentError}`);
          }

          const parsed = parseInstallment(installmentText);
          if (!parsed) {
            throw new Error(`${label}: formato de parcelamento inválido.`);
          }

          const derived = deriveStatusFromInstallment(parsed.paid, parsed.total);
          const value = derived === "paid" ? "pago" : formatInstallment(parsed.paid, parsed.total);

          nextExtra[field] = value;
          cerconTaxPatch[field] = value;
        }
      }

      const basePayload = {
        process_type: normalizeProcessType(form.process_type),
        protocolo: form.protocolo,
        municipio: normalizeMunicipio(form.municipio) || null,
        data_solicitacao: toCanonicalIsoDate(form.data_solicitacao) || null,
        situacao: form.situacao || null,
        obs: form.obs || null,
        extra: nextExtra,
      };

      if (modal.mode === "create") {
        const createPayload = isUnregistered
          ? {
              ...basePayload,
              company_id: null,
              empresa_nao_cadastrada: true,
              company_cnpj: normalizeDigits(form.company_cnpj),
              company_razao_social: String(form.company_razao_social || "").trim(),
            }
          : { ...basePayload, company_id: form.company_id };

        await apiJson("/api/v1/processos", {
          method: "POST",
          body: JSON.stringify(createPayload),
        });
      } else {
        await apiJson(`/api/v1/processos/${modal.processId}`, {
          method: "PATCH",
          body: JSON.stringify(basePayload),
        });
      }

      if (form.process_type === "CERCON" && form.company_id) {
        const taxRecord = await fetchCompanyTaxByCompanyId(form.company_id);
        if (!taxRecord?.id) {
          throw new Error("Não foi possível localizar o registro de taxas da empresa para sincronizar TPI/Taxa.");
        }

        const rawPayload = {};
        PROCESS_CERCON_TAX_FIELDS.forEach(([field]) => {
          const mappedField = PROCESS_CERCON_TAX_TO_COMPANY_TAX_FIELD[field];
          if (mappedField === "taxa_bombeiros") {
            rawPayload.taxa_bombeiros_observacao_pendente = cerconTaxRawPatch[field] ?? null;
          }
          if (mappedField === "tpi") {
            rawPayload.tpi_observacao_pendente = cerconTaxRawPatch[field] ?? null;
          }
        });

        await apiJson(`/api/v1/taxas/${taxRecord.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            taxa_bombeiros: cerconTaxPatch.taxa_bombeiros_sync_status ?? null,
            tpi: cerconTaxPatch.tpi_sync_status ?? null,
            raw: rawPayload,
          }),
        });
      }

      closeProcessModal();
      onRefresh?.("process-save");
    } finally {
      setIsSaving(false);
    }
  }, [
    apiJson,
    cerconTaxInstallmentDraft,
    cerconTaxPendingObservationDraft,
    cerconTaxStatusDraft,
    closeProcessModal,
    fetchCompanyTaxByCompanyId,
    form,
    modal.mode,
    modal.processId,
    onRefresh,
  ]);

  const deleteProcess = useCallback(async () => {
    if (modal.mode !== "edit" || !modal.processId) return;

    const confirmed = window.confirm("Excluir este processo? Essa ação é irreversível.");
    if (!confirmed) return;

    const password = promptPasswordForDelete();
    if (!password) return;

    setIsDeleting(true);
    try {
      await apiJson(`/api/v1/processos/${modal.processId}`, {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });

      closeProcessModal();
      onRefresh?.("process-delete");
    } finally {
      setIsDeleting(false);
    }
  }, [apiJson, closeProcessModal, modal.mode, modal.processId, onRefresh]);

  const selectedCompany = useMemo(
    () => companyOptions.find((item) => item.id === form.company_id) || null,
    [companyOptions, form.company_id],
  );

  return {
    modal,
    form,
    setForm,
    isSaving,
    isDeleting,
    companyOptions,
    selectedCompany,
    processSituacoes,
    processOperacoes,
    processOrgaos,
    processAlvaras,
    processServicos,
    processNotificacoes,
    cerconTaxStatusDraft,
    cerconTaxInstallmentDraft,
    cerconTaxInstallmentError,
    cerconTaxPendingObservationDraft,
    openProcess,
    closeProcessModal,
    updateExtra,
    saveProcess,
    deleteProcess,
    handleCerconTaxStatusChange,
    handleCerconTaxInstallmentChange,
    handleCerconTaxPendingObservationChange,
  };
}
