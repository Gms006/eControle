import { useCallback, useMemo, useState } from "react";
import {
  extractPrimaryPhoneDigits,
  formatMunicipioDisplay,
  normalizeEmail,
  normalizeMunicipio,
  normalizeTitleCase,
} from "@/lib/normalization";
import {
  hasInvalidFsDirname,
  maskCnpj,
  maskCpf,
  maskPhone,
  normalizeDigits,
  normalizeFsDirname,
  normalizePorteSigla,
} from "@/lib/masks";
import { mergeReceitaWsIntoCompanyForm, useReceitaWsLookup } from "@/hooks/useReceitaWsLookup";

export const EMPTY_COMPANY_FORM = {
  cnpj: "",
  razao_social: "",
  nome_fantasia: "",
  fs_dirname: "",
  inscricao_municipal: "",
  inscricao_estadual: "",
  porte: "",
  municipio: "",
  uf: "",
  categoria: "",
  is_active: true,
  mei: false,
  endereco_fiscal: false,
  representante: "",
  responsavel_fiscal: "",
  cpf: "",
  email: "",
  telefone: "",
  observacoes: "",
  cnaes_principal: [],
  cnaes_secundarios: [],
  add_licences: false,
  add_taxes: false,
  licences: {
    alvara_sanitario: false,
    alvara_funcionamento: false,
    cercon: false,
    licenca_ambiental: false,
    certidao_uso_solo: false,
    nao_necessita: false,
  },
  taxes: {
    funcionamento: false,
    publicidade: false,
    vigilancia_sanitaria: false,
    localizacao_instalacao: false,
    ocupacao_area_publica: false,
    tpi: false,
    vencimento_tpi: "",
  },
};

const EMPTY_MODAL = { open: false, mode: "create", companyId: null };

function promptPasswordForDelete() {
  const password = window.prompt("Confirme sua senha para prosseguir com a exclusão:");
  if (password === null) return null;
  const trimmed = String(password || "").trim();
  if (!trimmed) throw new Error("Senha obrigatória para confirmar a exclusão.");
  return trimmed;
}

export function useCompanyForm({ apiJson, onRefresh }) {
  const [modal, setModal] = useState(EMPTY_MODAL);
  const [form, setForm] = useState(EMPTY_COMPANY_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_COMPANY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    lookupCompany,
    loading: lookupLoading,
    error: lookupError,
    clearError,
    rfbLookup,
    rfbLoading,
    rfbError,
    clearRfbError,
    showRfbButton,
  } = useReceitaWsLookup({ apiJson });

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  const closeCompanyModal = useCallback(() => {
    setModal(EMPTY_MODAL);
  }, []);

  const openCompany = useCallback(
    async ({ mode = "create", companyId = null, cnpj = null }) => {
      let resolvedCompanyId = companyId || null;

      if (mode === "edit" && !resolvedCompanyId) {
        const digits = normalizeDigits(cnpj);
        if (digits.length === 14) {
          const dataByCnpj = await apiJson(`/api/v1/companies?cnpj=${digits}&limit=1`);
          if (Array.isArray(dataByCnpj) && dataByCnpj[0]?.id) {
            resolvedCompanyId = dataByCnpj[0].id;
          }
        }
      }

      setModal({ open: true, mode, companyId: resolvedCompanyId });

      if (mode === "edit") {
        if (!resolvedCompanyId) {
          throw new Error("Não foi possível localizar a empresa selecionada para edição.");
        }

        const data = await apiJson(`/api/v1/companies/${resolvedCompanyId}`);
        const nextForm = {
          ...EMPTY_COMPANY_FORM,
          cnpj: maskCnpj(data?.cnpj || ""),
          razao_social: data?.razao_social || "",
          nome_fantasia: data?.nome_fantasia || "",
          fs_dirname: data?.fs_dirname || "",
          inscricao_municipal: data?.inscricao_municipal || "",
          inscricao_estadual: data?.inscricao_estadual || "",
          porte: normalizePorteSigla(data?.porte || ""),
          municipio: formatMunicipioDisplay(data?.municipio || ""),
          uf: data?.uf || "",
          categoria: data?.categoria || "",
          is_active: data?.is_active !== false,
          mei: data?.mei === true,
          endereco_fiscal: data?.endereco_fiscal === true,
          representante: data?.proprietario_principal || "",
          responsavel_fiscal: data?.responsavel_fiscal || "",
          cpf: maskCpf(data?.cpf || ""),
          email: data?.email || "",
          telefone: maskPhone(data?.telefone || ""),
          observacoes: data?.observacoes || "",
          cnaes_principal: Array.isArray(data?.cnaes_principal) ? data.cnaes_principal : [],
          cnaes_secundarios: Array.isArray(data?.cnaes_secundarios) ? data.cnaes_secundarios : [],
        };

        setForm(nextForm);
        setInitialForm(nextForm);
        return;
      }

      setForm(EMPTY_COMPANY_FORM);
      setInitialForm(EMPTY_COMPANY_FORM);
    },
    [apiJson],
  );

  const importFromReceitaWs = useCallback(async () => {
    const data = await lookupCompany(form.cnpj);
    setForm((prev) => mergeReceitaWsIntoCompanyForm(prev, data));
  }, [lookupCompany, form.cnpj]);

  const importFromRfb = useCallback(async () => {
    const data = await rfbLookup(form.cnpj);
    setForm((prev) => mergeReceitaWsIntoCompanyForm(prev, data));
  }, [rfbLookup, form.cnpj]);

  const saveCompany = useCallback(async () => {
    setIsSaving(true);

    try {
      const digits = normalizeDigits(form.cnpj);
      if (digits.length !== 14) throw new Error("CNPJ inválido");
      if (!form.razao_social?.trim()) throw new Error("Razão social obrigatória");
      if (hasInvalidFsDirname(form.fs_dirname)) {
        throw new Error("Apelido (Pasta) inválido: não use '..', '/', '\\' ou ':'");
      }

      const categoriaFinal =
        form.endereco_fiscal && form.categoria && !form.categoria.startsWith("Fiscal -")
          ? `Fiscal - ${form.categoria}`
          : form.categoria;

      if (modal.mode === "create") {
        await apiJson("/api/v1/companies/composite", {
          method: "POST",
          body: JSON.stringify({
            company: {
              cnpj: digits,
              razao_social: normalizeTitleCase(form.razao_social),
              nome_fantasia: normalizeTitleCase(form.nome_fantasia) || null,
              fs_dirname: normalizeFsDirname(form.fs_dirname) || null,
              municipio: normalizeMunicipio(form.municipio) || null,
              uf: form.uf || null,
              is_active: form.is_active !== false,
            },
            profile: {
              inscricao_municipal: form.inscricao_municipal || null,
              inscricao_estadual: form.inscricao_estadual || null,
              porte: normalizePorteSigla(form.porte) || null,
              categoria: categoriaFinal || null,
              proprietario_principal: form.representante || null,
              responsavel_fiscal: form.responsavel_fiscal || null,
              cpf: normalizeDigits(form.cpf) || null,
              email: normalizeEmail(form.email) || null,
              telefone: extractPrimaryPhoneDigits(form.telefone) || null,
              observacoes: form.observacoes || null,
              cnaes_principal: form.cnaes_principal || [],
              cnaes_secundarios: form.cnaes_secundarios || [],
              mei: !!form.mei,
              endereco_fiscal: !!form.endereco_fiscal,
            },
            licences: form.add_licences
              ? form.licences
              : undefined,
            taxes: form.add_taxes
              ? {
                  ...form.taxes,
                  vencimento_tpi: form.taxes.vencimento_tpi || null,
                }
              : undefined,
          }),
        });
      } else {
        await apiJson(`/api/v1/companies/${modal.companyId}`, {
          method: "PATCH",
          body: JSON.stringify({
            razao_social: normalizeTitleCase(form.razao_social),
            nome_fantasia: normalizeTitleCase(form.nome_fantasia) || null,
            fs_dirname: normalizeFsDirname(form.fs_dirname) || null,
            municipio: normalizeMunicipio(form.municipio) || null,
            uf: form.uf || null,
            is_active: form.is_active !== false,
            inscricao_municipal: form.inscricao_municipal || null,
            inscricao_estadual: form.inscricao_estadual || null,
            porte: normalizePorteSigla(form.porte) || null,
            categoria: categoriaFinal || null,
            proprietario_principal: normalizeTitleCase(form.representante) || null,
            responsavel_fiscal: form.responsavel_fiscal || null,
            cpf: normalizeDigits(form.cpf) || null,
            email: normalizeEmail(form.email) || null,
            telefone: extractPrimaryPhoneDigits(form.telefone) || null,
            observacoes: form.observacoes || null,
            cnaes_principal: form.cnaes_principal || [],
            cnaes_secundarios: form.cnaes_secundarios || [],
          }),
        });
      }

      closeCompanyModal();
      onRefresh?.("company-save");
    } finally {
      setIsSaving(false);
    }
  }, [apiJson, closeCompanyModal, form, modal.companyId, modal.mode, onRefresh]);

  const deleteCompany = useCallback(async () => {
    if (modal.mode !== "edit" || !modal.companyId) return;

    const confirmed = window.confirm("Excluir esta empresa? Essa ação é irreversível.");
    if (!confirmed) return;

    const password = promptPasswordForDelete();
    if (!password) return;

    setIsDeleting(true);
    try {
      await apiJson(`/api/v1/companies/${modal.companyId}`, {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });

      closeCompanyModal();
      onRefresh?.("company-delete");
    } finally {
      setIsDeleting(false);
    }
  }, [apiJson, closeCompanyModal, modal.companyId, modal.mode, onRefresh]);

  return {
    modal,
    form,
    setForm,
    initialForm,
    isDirty,
    isSaving,
    isDeleting,
    lookupLoading,
    lookupError,
    clearError,
    importFromRfb,
    rfbLoading,
    rfbError,
    clearRfbError,
    showRfbButton,
    openCompany,
    closeCompanyModal,
    importFromReceitaWs,
    saveCompany,
    deleteCompany,
  };
}