import { useEffect, useMemo, useRef, useState } from "react";

import { listCopilotCompanies, respondCopilot } from "@/services/copilot";
import { COPILOT_CATEGORIES } from "@/services/copilot";

const STORAGE_KEY = "econtrole.copilot.state.v1";

const mapCopilotErrorMessage = (rawMessage) => {
  const text = String(rawMessage || "").toLowerCase();
  if (text.includes("chave gemini") || text.includes("gemini_api_key")) {
    return "Chave Gemini ausente. Configure GEMINI_API_KEY para usar o copiloto.";
  }
  if (text.includes("tempo limite") || text.includes("timeout")) {
    return "O provider demorou para responder. Tente novamente.";
  }
  if (text.includes("limite de requisi") || text.includes("429") || text.includes("quota")) {
    return "Limite do provider atingido no momento. Tente novamente em instantes.";
  }
  if (text.includes("indispon")) {
    return "Provider indisponível no momento. Tente novamente.";
  }
  if (text.includes("fallback")) {
    return "Não foi possível responder agora (fallback esgotado).";
  }
  return rawMessage || "Não foi possível obter resposta do copiloto.";
};

const readStoredState = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStoredState = (value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // no-op
  }
};

export function useCopilotWidget({ enabled = true } = {}) {
  const initial = readStoredState() || {};
  const [panelState, setPanelState] = useState(initial.panelState || "closed");
  const [category, setCategory] = useState(initial.category || "");
  const [company, setCompany] = useState(initial.company || null);
  const [companySearch, setCompanySearch] = useState("");
  const [companyOptions, setCompanyOptions] = useState([]);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [messages, setMessages] = useState(Array.isArray(initial.messages) ? initial.messages : []);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [needsCompanySelection, setNeedsCompanySelection] = useState(false);
  const debounceRef = useRef(0);
  const requestAbortRef = useRef(null);

  useEffect(() => {
    writeStoredState({
      panelState,
      category,
      company,
      messages: Array.isArray(messages) ? messages.slice(-30) : [],
    });
  }, [panelState, category, company, messages]);

  useEffect(() => {
    if (!enabled) return;
    const token = window.setTimeout(async () => {
      const q = String(companySearch || "").trim();
      if (!q || q.length < 2) {
        setCompanyOptions([]);
        return;
      }
      const requestId = Date.now();
      debounceRef.current = requestId;
      setCompanyLoading(true);
      try {
        const payload = await listCopilotCompanies({ term: q, limit: 8 });
        if (debounceRef.current !== requestId) return;
        setCompanyOptions(Array.isArray(payload) ? payload : []);
      } catch {
        if (debounceRef.current !== requestId) return;
        setCompanyOptions([]);
      } finally {
        if (debounceRef.current === requestId) {
          setCompanyLoading(false);
        }
      }
    }, 350);
    return () => window.clearTimeout(token);
  }, [companySearch, enabled]);

  const requiresCompany = useMemo(
    () =>
      category !== COPILOT_CATEGORIES.DUVIDAS_DIVERSAS &&
      Boolean(category),
    [category],
  );
  const canAsk = useMemo(() => {
    if (!category) return false;
    if (!requiresCompany && !needsCompanySelection) return true;
    return Boolean(company?.id);
  }, [category, requiresCompany, needsCompanySelection, company]);

  const open = () => setPanelState("open");
  const close = () => setPanelState("closed");
  const minimize = () => setPanelState("minimized");
  const resetConversation = () => {
    setMessages([]);
    setError("");
  };

  const selectCategory = (nextCategory) => {
    setCategory(nextCategory);
    setMessages([]);
    setError("");
    setNeedsCompanySelection(false);
  };

  const selectCompany = (nextCompany) => {
    setCompany(nextCompany);
    setCompanySearch("");
    setCompanyOptions([]);
    setError("");
    setNeedsCompanySelection(false);
  };

  const clearCompany = () => {
    setCompany(null);
    setMessages([]);
    setError("");
    setNeedsCompanySelection(false);
  };

  const resetAll = () => {
    if (requestAbortRef.current) {
      requestAbortRef.current.abort();
      requestAbortRef.current = null;
    }
    setPanelState("closed");
    setCategory("");
    setCompany(null);
    setCompanySearch("");
    setCompanyOptions([]);
    setMessages([]);
    setError("");
    setNeedsCompanySelection(false);
  };

  const sendMessage = async ({ text, file }) => {
    if (!enabled || !canAsk || sending) return null;
    setSending(true);
    setError("");
    const userText = (text || "").trim();
    if (
      category === COPILOT_CATEGORIES.DUVIDAS_DIVERSAS &&
      !company?.id &&
      /\b(essa empresa|desta empresa|da empresa|esta empresa)\b/i.test(userText)
    ) {
      setNeedsCompanySelection(true);
      setError("Esta pergunta precisa de empresa selecionada.");
      setSending(false);
      return null;
    }
    const userMessage = userText || (file ? `Documento enviado: ${file.name}` : "");
    if (userMessage) {
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: userMessage }]);
    }
    const controller = new AbortController();
    requestAbortRef.current = controller;
    try {
      const response = await respondCopilot({
        category,
        companyId: company?.id,
        message: userText,
        documentFile: file || undefined,
        signal: controller.signal,
      });
      const assistantMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        payload: response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      if (response?.requires_company === true && !company?.id) {
        setError("Esta pergunta precisa de empresa selecionada.");
        setNeedsCompanySelection(true);
      }
      return response;
    } catch (err) {
      if (controller.signal.aborted) {
        return null;
      }
      const message = mapCopilotErrorMessage(err?.message || "");
      setError(message);
      return null;
    } finally {
      if (requestAbortRef.current === controller) {
        requestAbortRef.current = null;
      }
      setSending(false);
    }
  };

  return {
    panelState,
    category,
    company,
    companySearch,
    companyOptions,
    companyLoading,
    messages,
    sending,
    error,
    canAsk,
    requiresCompany,
    needsCompanySelection,
    open,
    close,
    minimize,
    resetConversation,
    selectCategory,
    selectCompany,
    clearCompany,
    resetAll,
    setCompanySearch,
    sendMessage,
  };
}
