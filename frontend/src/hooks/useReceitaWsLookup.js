import { useCallback, useState } from "react";
import {
  extractPrimaryPhoneDigits,
  formatMunicipioDisplay,
  normalizeEmail,
  normalizeTitleCase,
} from "@/lib/normalization";
import { maskPhone, normalizeDigits, normalizePorteSigla } from "@/lib/masks";

export function mergeReceitaWsIntoCompanyForm(prev, data) {
  return {
    ...prev,
    razao_social: normalizeTitleCase(data?.razao_social || prev.razao_social),
    nome_fantasia: normalizeTitleCase(data?.nome_fantasia || prev.nome_fantasia),
    porte: normalizePorteSigla(data?.porte || prev.porte),
    municipio: formatMunicipioDisplay(data?.municipio_padrao || data?.municipio || prev.municipio),
    uf: data?.uf || prev.uf,
    email: normalizeEmail(data?.email || prev.email),
    telefone: maskPhone(extractPrimaryPhoneDigits(data?.telefone || prev.telefone)),
    mei: data?.simei_optante === true ? true : prev.mei,
    cnaes_principal: Array.isArray(data?.cnaes_principal) ? data.cnaes_principal : prev.cnaes_principal,
    cnaes_secundarios: Array.isArray(data?.cnaes_secundarios)
      ? data.cnaes_secundarios
      : prev.cnaes_secundarios,
  };
}

/**
 * Retorna true se o resultado da consulta tem dados mínimos úteis.
 * Deve espelhar a lógica de `is_result_useful` em lookups.py.
 */
function isResultUseful(data) {
  return Boolean((data?.razao_social || "").trim());
}

export function useReceitaWsLookup({ apiJson }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --- Estado do fallback RFB ---
  const [rfbLoading, setRfbLoading] = useState(false);
  const [rfbError, setRfbError] = useState("");
  /**
   * showRfbButton: true quando a última consulta ReceitaWS retornou sem dados
   * úteis (razao_social vazia). Volta a false após uma consulta RFB bem-sucedida
   * ou quando o usuário dispara uma nova importação ReceitaWS.
   */
  const [showRfbButton, setShowRfbButton] = useState(false);

  // --- ReceitaWS (fluxo principal) ---
  const lookupCompany = useCallback(
    async (cnpj) => {
      const digits = normalizeDigits(cnpj);
      if (digits.length !== 14) {
        throw new Error("Informe um CNPJ válido antes de importar.");
      }

      setLoading(true);
      setError("");
      setShowRfbButton(false);
      setRfbError("");

      try {
        const data = await apiJson(`/api/v1/lookups/receitaws/${digits}`);
        if (!data || data?.status === "ERROR") {
          throw new Error(data?.message || "Não foi possível importar dados deste CNPJ.");
        }

        // Sinaliza se o resultado é útil ou se o botão RFB deve aparecer
        if (!isResultUseful(data)) {
          setShowRfbButton(true);
        }

        return data;
      } catch (err) {
        const message = String(err?.message || "Falha ao consultar ReceitaWS.");
        setError(message);
        // Se a consulta falhou completamente, também oferece o RFB
        setShowRfbButton(true);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiJson],
  );

  // --- Fallback: Agente RFB ---
  const rfbLookup = useCallback(
    async (cnpj) => {
      const digits = normalizeDigits(cnpj);
      if (digits.length !== 14) {
        throw new Error("Informe um CNPJ válido antes de consultar a RFB.");
      }

      setRfbLoading(true);
      setRfbError("");

      try {
        const data = await apiJson(`/api/v1/lookups/rfb/${digits}`, {
          // Timeout longo: usuário precisa resolver captcha (até 6 min)
          timeout: 370_000,
        });

        if (!data || data?.status === "ERROR") {
          throw new Error(data?.message || "Não foi possível obter dados da RFB.");
        }

        // Consulta RFB bem-sucedida: esconde o botão
        setShowRfbButton(false);
        return data;
      } catch (err) {
        const raw = String(err?.message || "");

        // Traduz erros conhecidos para mensagens amigáveis
        let message = raw;
        if (raw.includes("503") || raw.includes("não está rodando")) {
          message =
            "Agente RFB não está rodando. Inicie com: python scripts/rfb_agent.py";
        } else if (raw.includes("409") || raw.includes("outra consulta")) {
          message =
            "Já há uma consulta RFB em andamento. Aguarde e tente novamente.";
        } else if (raw.includes("504") || raw.includes("Timeout")) {
          message =
            "Tempo esgotado. Resolva o captcha dentro de 5 minutos e tente novamente.";
        } else if (!message) {
          message = "Falha ao consultar a Receita Federal. Tente novamente.";
        }

        setRfbError(message);
        throw err;
      } finally {
        setRfbLoading(false);
      }
    },
    [apiJson],
  );

  return {
    // ReceitaWS
    lookupCompany,
    loading,
    error,
    clearError: () => setError(""),

    // RFB fallback
    rfbLookup,
    rfbLoading,
    rfbError,
    clearRfbError: () => setRfbError(""),
    showRfbButton,
  };
}