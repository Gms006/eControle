import { useCallback, useMemo, useState } from "react";
import {
  TAX_DATA_ENVIO_METHOD_OPTIONS,
  formatDataEnvio,
  parseDataEnvio,
  toDateInputFromDataEnvio,
} from "@/lib/taxes";
import { formatMunicipioDisplay } from "@/lib/normalization";
import { formatStatusDisplay } from "@/lib/status";
import {
  deriveStatusFromInstallment,
  formatInstallment,
  normalizeInstallmentInput,
  parseInstallment,
  validateInstallmentInput,
} from "@/lib/installment";

export const EMPTY_TAX_FORM = {
  id: "",
  company_id: "",
  empresa: "",
  municipio: "",
  data_envio: "",
  taxa_funcionamento: "",
  taxa_publicidade: "",
  taxa_vig_sanitaria: "",
  taxa_localiz_instalacao: "",
  taxa_ocup_area_publica: "",
  taxa_bombeiros: "",
  tpi: "",
  vencimento_tpi: "",
  iss: "",
  raw: {},
};

const EMPTY_MODAL = { open: false, mode: "edit", taxId: null };
const OPEN_YEAR_RE = /\b(19|20)\d{2}\b/g;

export const TAX_STATUS_FIELDS = [
  ["taxa_funcionamento", "Funcionamento"],
  ["taxa_publicidade", "Publicidade"],
  ["taxa_vig_sanitaria", "Vigilância Sanitária"],
  ["taxa_localiz_instalacao", "Localização/Instalação"],
  ["taxa_ocup_area_publica", "Área Pública"],
  ["taxa_bombeiros", "Bombeiros"],
  ["tpi", "TPI"],
  ["iss", "ISS"],
];

export const TAX_STATUS_OPTIONS = ["", "em_aberto", "parcelado", "pago", "isento", "nao_aplicavel", "pendente"];
export const TAX_STATUS_OPTION_ITEMS = TAX_STATUS_OPTIONS.map((value) => ({
  value,
  label: value ? formatStatusDisplay(value) : "—",
}));

export { TAX_DATA_ENVIO_METHOD_OPTIONS };

const pendingObservationFieldKey = (field) => `${field}_observacao_pendente`;
const openYearsFieldKey = (field) => `${field}_anos_em_aberto`;

const normalizeStatusKey = (value) =>
  String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeOpenYears = (values) =>
  [...new Set((values || []).map((year) => Number(year)).filter((year) => Number.isInteger(year) && year >= 1900 && year <= 2099))].sort(
    (a, b) => a - b,
  );

const extractOpenYears = (value) => {
  if (Array.isArray(value)) return normalizeOpenYears(value);
  const text = String(value || "");
  if (!text) return [];
  const matches = text.match(OPEN_YEAR_RE) || [];
  return normalizeOpenYears(matches.map((year) => Number(year)));
};

const formatOpenYearsInput = (years) => normalizeOpenYears(years).join(", ");

export function useTaxForm({ apiJson, onRefresh }) {
  const [modal, setModal] = useState(EMPTY_MODAL);
  const [form, setForm] = useState(EMPTY_TAX_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [statusModeDraft, setStatusModeDraft] = useState({});
  const [installmentDraft, setInstallmentDraft] = useState({});
  const [installmentError, setInstallmentError] = useState({});
  const [pendingObservationDraft, setPendingObservationDraft] = useState({});
  const [openYearsDraft, setOpenYearsDraft] = useState({});
  const [envioDateDraft, setEnvioDateDraft] = useState("");
  const [envioMethodsDraft, setEnvioMethodsDraft] = useState([]);

  const closeTaxModal = useCallback(() => {
    setModal(EMPTY_MODAL);
    setStatusModeDraft({});
    setInstallmentDraft({});
    setInstallmentError({});
    setPendingObservationDraft({});
    setOpenYearsDraft({});
    setEnvioDateDraft("");
    setEnvioMethodsDraft([]);
  }, []);

  const normalizeTaxForm = useCallback((data) => ({
    ...EMPTY_TAX_FORM,
    id: data?.id || data?.tax_id || "",
    company_id: data?.company_id || data?.empresa_id || "",
    empresa: data?.empresa || data?.razao_social || "",
    municipio: formatMunicipioDisplay(data?.municipio || ""),
    data_envio: data?.data_envio || "",
    taxa_funcionamento: data?.taxa_funcionamento || data?.func || "",
    taxa_publicidade: data?.taxa_publicidade || data?.publicidade || "",
    taxa_vig_sanitaria: data?.taxa_vig_sanitaria || data?.sanitaria || "",
    taxa_localiz_instalacao: data?.taxa_localiz_instalacao || data?.localizacao_instalacao || "",
    taxa_ocup_area_publica: data?.taxa_ocup_area_publica || data?.area_publica || "",
    taxa_bombeiros: data?.taxa_bombeiros || data?.bombeiros || "",
    tpi: data?.tpi || "",
    vencimento_tpi: data?.vencimento_tpi || "",
    iss: data?.iss || "",
    raw: data?.raw && typeof data.raw === "object" ? data.raw : {},
  }), []);

  const initializeTaxStatusDraft = useCallback((normalized) => {
    const nextMode = {};
    const nextInstallment = {};
    const nextPendingObservation = {};
    const nextOpenYears = {};
    const rawData = normalized?.raw && typeof normalized.raw === "object" ? normalized.raw : {};

    TAX_STATUS_FIELDS.forEach(([field]) => {
      const raw = String(normalized?.[field] || "").trim();
      const statusKey = normalizeStatusKey(raw);
      const parsed = parseInstallment(raw);
      const pendingObsValue = String(rawData?.[pendingObservationFieldKey(field)] || "").trim();
      const openYearsValue = extractOpenYears(rawData?.[openYearsFieldKey(field)]);
      const openYearsFromStatus = extractOpenYears(raw);
      const mergedOpenYears = normalizeOpenYears([...openYearsValue, ...openYearsFromStatus]);

      if (pendingObsValue) {
        nextPendingObservation[field] = pendingObsValue;
      }

      if (parsed) {
        const derived = deriveStatusFromInstallment(parsed.paid, parsed.total);
        if (derived === "paid") {
          nextMode[field] = "pago";
        } else {
          nextMode[field] = "parcelado";
          nextInstallment[field] = formatInstallment(parsed.paid, parsed.total);
        }
        return;
      }

      if (statusKey.startsWith("em_aberto") || statusKey.includes("aberto")) {
        nextMode[field] = "em_aberto";
      } else {
        nextMode[field] = raw || "";
      }

      if (mergedOpenYears.length > 0) {
        nextOpenYears[field] = formatOpenYearsInput(mergedOpenYears);
      }

      if (raw === "parcelado") {
        nextInstallment[field] = "/";
      }
    });

    setStatusModeDraft(nextMode);
    setInstallmentDraft(nextInstallment);
    setInstallmentError({});
    setPendingObservationDraft(nextPendingObservation);
    setOpenYearsDraft(nextOpenYears);
  }, []);

  const openTax = useCallback(
    async ({ mode = "edit", taxId, taxa }) => {
      if (!taxId && !taxa?.id) {
        throw new Error("Taxa sem identificador para edição.");
      }

      const resolvedTaxId = taxId || taxa?.id;
      setModal({ open: true, mode, taxId: resolvedTaxId || null });

      if (taxa) {
        const normalized = normalizeTaxForm(taxa);
        const parsedEnvio = parseDataEnvio(normalized.data_envio);
        setForm(normalized);
        initializeTaxStatusDraft(normalized);
        setEnvioDateDraft(toDateInputFromDataEnvio(normalized.data_envio));
        setEnvioMethodsDraft(parsedEnvio.methods);
        return;
      }

      const data = await apiJson("/api/v1/taxas?limit=1000");
      const list = Array.isArray(data) ? data : [];
      const selected = list.find((item) => item?.id === resolvedTaxId);
      if (!selected) {
        throw new Error("Não foi possível localizar a taxa para edição.");
      }

      const normalized = normalizeTaxForm(selected);
      const parsedEnvio = parseDataEnvio(normalized.data_envio);
      setForm(normalized);
      initializeTaxStatusDraft(normalized);
      setEnvioDateDraft(toDateInputFromDataEnvio(normalized.data_envio));
      setEnvioMethodsDraft(parsedEnvio.methods);
    },
    [apiJson, initializeTaxStatusDraft, normalizeTaxForm],
  );

  const handleStatusChange = useCallback((field, value) => {
    setStatusModeDraft((prev) => ({ ...prev, [field]: value }));

    if (value !== "pendente") {
      setPendingObservationDraft((prev) => {
        const clone = { ...prev };
        delete clone[field];
        return clone;
      });
    }

    if (value !== "em_aberto") {
      setOpenYearsDraft((prev) => {
        const clone = { ...prev };
        delete clone[field];
        return clone;
      });
    }

    if (value === "parcelado") {
      setInstallmentDraft((prev) => ({ ...prev, [field]: prev[field] || "/" }));
      setInstallmentError((prev) => ({ ...prev, [field]: validateInstallmentInput("/") }));
      return;
    }

    setForm((prev) => ({ ...prev, [field]: value }));

    setInstallmentDraft((prev) => {
      const clone = { ...prev };
      delete clone[field];
      return clone;
    });

    setInstallmentError((prev) => {
      const clone = { ...prev };
      delete clone[field];
      return clone;
    });
  }, []);

  const handleInstallmentChange = useCallback((field, value) => {
    const normalized = normalizeInstallmentInput(value);
    setInstallmentDraft((prev) => ({ ...prev, [field]: normalized }));
    setInstallmentError((prev) => ({ ...prev, [field]: validateInstallmentInput(normalized) }));
  }, []);

  const handlePendingObservationChange = useCallback((field, value) => {
    setPendingObservationDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleOpenYearsChange = useCallback((field, value) => {
    setOpenYearsDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleEnvioMetodo = useCallback((metodo) => {
    setEnvioMethodsDraft((prev) =>
      prev.includes(metodo) ? prev.filter((item) => item !== metodo) : [...prev, metodo],
    );
  }, []);

  const saveTax = useCallback(async () => {
    if (!modal.taxId) throw new Error("Taxa sem identificador.");

    setIsSaving(true);

    try {
      const normalizedDataEnvio = formatDataEnvio(envioDateDraft, envioMethodsDraft);
      const nextPayloadStatus = {};
      const nextPayloadRaw = {};

      for (const [field, label] of TAX_STATUS_FIELDS) {
        const mode = String(statusModeDraft[field] ?? form[field] ?? "").trim();

        if (!mode) {
          nextPayloadStatus[field] = null;
          nextPayloadRaw[pendingObservationFieldKey(field)] = null;
          nextPayloadRaw[openYearsFieldKey(field)] = null;
          continue;
        }

        if (mode === "pendente") {
          const note = String(pendingObservationDraft[field] || "").trim();
          nextPayloadRaw[pendingObservationFieldKey(field)] = note || null;
        } else {
          nextPayloadRaw[pendingObservationFieldKey(field)] = null;
        }

        if (mode === "em_aberto") {
          const yearsText = String(openYearsDraft[field] || "").trim();
          const years = extractOpenYears(yearsText);

          if (yearsText && years.length === 0) {
            throw new Error(`${label}: informe anos válidos no formato AAAA, AAAA.`);
          }

          nextPayloadRaw[openYearsFieldKey(field)] = years.length > 0 ? years : null;
          nextPayloadStatus[field] = "em_aberto";
          continue;
        }

        nextPayloadRaw[openYearsFieldKey(field)] = null;

        if (mode !== "parcelado") {
          nextPayloadStatus[field] = mode;
          continue;
        }

        const installmentText = String(installmentDraft[field] ?? "").trim();
        const installmentValidation = validateInstallmentInput(installmentText);
        if (installmentValidation) {
          throw new Error(`${label}: ${installmentValidation}`);
        }

        const parsed = parseInstallment(installmentText);
        if (!parsed) {
          throw new Error(`${label}: formato de parcelamento inválido.`);
        }

        const derived = deriveStatusFromInstallment(parsed.paid, parsed.total);
        nextPayloadStatus[field] =
          derived === "paid" ? "pago" : formatInstallment(parsed.paid, parsed.total);
      }

      await apiJson(`/api/v1/taxas/${modal.taxId}`, {
        method: "PATCH",
        body: JSON.stringify({
          data_envio: normalizedDataEnvio,
          taxa_funcionamento: nextPayloadStatus.taxa_funcionamento,
          taxa_publicidade: nextPayloadStatus.taxa_publicidade,
          taxa_vig_sanitaria: nextPayloadStatus.taxa_vig_sanitaria,
          taxa_localiz_instalacao: nextPayloadStatus.taxa_localiz_instalacao,
          taxa_ocup_area_publica: nextPayloadStatus.taxa_ocup_area_publica,
          taxa_bombeiros: nextPayloadStatus.taxa_bombeiros,
          tpi: nextPayloadStatus.tpi,
          vencimento_tpi: form.vencimento_tpi || null,
          iss: nextPayloadStatus.iss,
          raw: nextPayloadRaw,
        }),
      });

      closeTaxModal();
      onRefresh?.("tax-save");
    } finally {
      setIsSaving(false);
    }
  }, [
    apiJson,
    closeTaxModal,
    envioDateDraft,
    envioMethodsDraft,
    form,
    installmentDraft,
    modal.taxId,
    onRefresh,
    openYearsDraft,
    pendingObservationDraft,
    statusModeDraft,
  ]);

  const progressSummary = useMemo(
    () => ({
      envioDateDraft,
      envioMethodsDraft,
    }),
    [envioDateDraft, envioMethodsDraft],
  );

  return {
    modal,
    form,
    setForm,
    isSaving,
    statusModeDraft,
    installmentDraft,
    installmentError,
    pendingObservationDraft,
    openYearsDraft,
    envioDateDraft,
    envioMethodsDraft,
    progressSummary,
    openTax,
    closeTaxModal,
    saveTax,
    setEnvioDateDraft,
    toggleEnvioMetodo,
    handleStatusChange,
    handleInstallmentChange,
    handlePendingObservationChange,
    handleOpenYearsChange,
  };
}