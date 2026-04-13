import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Building2,
  ChevronDown,
  ChevronRight,
  FileSearch,
  MessageSquare,
  Minus,
  Paperclip,
  Search,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { COPILOT_CATEGORIES } from "@/services/copilot";
import { useCopilotWidget } from "@/hooks/useCopilotWidget";

const CATEGORY_META = {
  [COPILOT_CATEGORIES.COMPANY_SUMMARY]: {
    title: "Entender empresa",
    examples: [
      "Resuma a situação desta empresa",
      "Explique por que o risco dela está alto",
      "Liste pendências prioritárias",
      "Monte um plano de ação para os próximos 30 dias",
    ],
  },
  [COPILOT_CATEGORIES.DOCUMENT_ANALYSIS]: {
    title: "Analisar documento",
    examples: [
      "Analise este documento e diga o que ele parece ser",
      "Extraia validade, órgão e município",
      "Compare com o cadastro atual da empresa",
      "Aponte inconsistências ou conflitos",
    ],
  },
  [COPILOT_CATEGORIES.RISK_SIMULATION]: {
    title: "Simular impacto no risco",
    examples: [
      "Se eu renovar o alvará bombeiros, o que muda?",
      "Se eu atualizar sanitário e funcionamento, o risco cai?",
      "Qual ação reduz mais a urgência desta empresa?",
      "Qual documento tem maior impacto no score?",
    ],
  },
  [COPILOT_CATEGORIES.DUVIDAS_DIVERSAS]: {
    title: "Dúvidas diversas",
    examples: [
      "O que faz uma empresa ser sujeita ao TPI?",
      "O CNAE 1062700 é de baixo, médio ou alto risco em Anápolis?",
      "O que mais pesa no score de urgência?",
      "Quando uma CND municipal costuma ser exigida?",
      "Qual a diferença entre alvará e certidão?",
    ],
  },
};

const CATEGORY_ORDER = [
  COPILOT_CATEGORIES.COMPANY_SUMMARY,
  COPILOT_CATEGORIES.DOCUMENT_ANALYSIS,
  COPILOT_CATEGORIES.RISK_SIMULATION,
  COPILOT_CATEGORIES.DUVIDAS_DIVERSAS,
];

const CATEGORY_ICONS = {
  [COPILOT_CATEGORIES.COMPANY_SUMMARY]: Sparkles,
  [COPILOT_CATEGORIES.DOCUMENT_ANALYSIS]: FileSearch,
  [COPILOT_CATEGORIES.RISK_SIMULATION]: Bot,
  [COPILOT_CATEGORIES.DUVIDAS_DIVERSAS]: Bot,
};

function messageTimestamp(messageId) {
  const match = String(messageId || "").match(/-(\d{10,})$/);
  if (!match) return "";
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return "";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function CategoryStep({ onSelect }) {
  return (
    <div className="space-y-2" data-testid="copilot-step-categories">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Escolha uma categoria</p>
      {CATEGORY_ORDER.map((category) => (
        (() => {
          const Icon = CATEGORY_ICONS[category] || Bot;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onSelect(category)}
              data-testid={`copilot-category-${category}`}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-indigo-500" />
                {CATEGORY_META[category].title}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          );
        })()
      ))}
    </div>
  );
}

function CompanyStep({
  company,
  companySearch,
  companyOptions,
  companyLoading,
  onSearch,
  onSelect,
}) {
  if (company) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" data-testid="copilot-company-selected">
        Empresa selecionada: <strong>{company.razao_social}</strong>
      </div>
    );
  }
  return (
    <div className="relative space-y-2" data-testid="copilot-step-company">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selecione a empresa</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={companySearch}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Digite razão social..."
          className="pl-9"
          data-testid="copilot-company-search"
        />
      </div>
      {companyLoading ? <p className="text-xs text-slate-500">Buscando empresas...</p> : null}
      <div className="max-h-40 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {companyOptions.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid="copilot-company-option"
            onClick={() => onSelect(item)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="font-semibold">{item.razao_social}</div>
            <div className="text-[11px] text-slate-500">{item.cnpj || "Sem CNPJ"}</div>
          </button>
        ))}
        {!companyLoading && companySearch.trim().length >= 2 && companyOptions.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma empresa encontrada.</p>
        ) : null}
      </div>
    </div>
  );
}

function AssistantAnswer({ payload, onQuickAction }) {
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  const actions = Array.isArray(payload?.suggested_actions) ? payload.suggested_actions : [];
  const warnings = Array.isArray(payload?.warnings) ? payload.warnings : [];
  const evidence = Array.isArray(payload?.evidence) ? payload.evidence : [];
  const sources = Array.isArray(payload?.sources) ? payload.sources : [];
  const groundingUsed = Boolean(payload?.grounding_used);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  return (
    <div className="flex items-start gap-2">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
        <Bot className="h-4 w-4" />
      </div>
      <div className="space-y-2">
        <div className="max-w-[300px] rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-800">
          <div className="prose prose-sm max-w-none text-slate-800 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5">
            <ReactMarkdown>{payload?.answer_markdown || "Sem resposta."}</ReactMarkdown>
          </div>
          <div className="mt-2 space-y-2" data-testid="copilot-response-structured">
            {groundingUsed ? (
              <div
                className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-800"
                data-testid="copilot-grounding-indicator"
              >
                Resposta com busca externa
              </div>
            ) : null}
            {sections.map((section) => (
              <div key={section.id} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                <p className="text-sm font-semibold text-slate-800">{section.title}</p>
                <p className="mt-1 text-xs text-slate-700">{section.content}</p>
                {Array.isArray(section.items) && section.items.length > 0 ? (
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-700">
                    {section.items.map((item, index) => (
                      <li key={`${section.id}-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
          {warnings.length > 0 ? (
            <div className="mt-2 space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
              {warnings.map((warning, index) => (
                <p key={`warning-${index}`} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{warning}</span>
                </p>
              ))}
            </div>
          ) : null}
          {evidence.length > 0 ? (
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
              <button
                type="button"
                onClick={() => setEvidenceOpen((value) => !value)}
                className="flex w-full items-center justify-between text-xs font-medium text-slate-700"
              >
                Evidências
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${evidenceOpen ? "rotate-180" : ""}`} />
              </button>
              {evidenceOpen ? (
                <div className="mt-1.5 space-y-1 text-xs text-slate-600">
                  {evidence.map((item, index) => (
                    <p key={`evidence-${index}`}>
                      <span className="font-medium">{item.label}:</span> {item.value}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {sources.length > 0 ? (
            <div className="mt-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2">
              <p className="text-xs font-semibold text-slate-700">Fontes</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-700">
                {sources.map((source, index) => (
                  <li key={`source-${index}`}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-700 underline-offset-2 hover:underline"
                      data-testid="copilot-source-link"
                    >
                      {source.title || source.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {actions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {actions.map((action) => (
                action?.url ? (
                  <a
                    key={action.id || `${action.label}-${action.url}`}
                    href={action.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-7 items-center rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50"
                    data-testid="copilot-quick-action"
                  >
                    {action.label}
                  </a>
                ) : (
                  <Button
                    key={action.id || action.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full px-3 text-xs"
                    onClick={() => onQuickAction(action)}
                    data-testid="copilot-quick-action"
                  >
                    {action.label}
                  </Button>
                )
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function CopilotWidget({ roles = [], onNavigateRoute }) {
  const allowed = useMemo(
    () => Array.isArray(roles) && roles.some((role) => ["ADMIN", "DEV", "VIEW"].includes(role)),
    [roles],
  );
  const {
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
    minimize,
    selectCategory,
    selectCompany,
    clearCompany,
    resetAll,
    setCompanySearch,
    sendMessage,
  } = useCopilotWidget({ enabled: allowed });
  const [draft, setDraft] = useState("");
  const [documentFile, setDocumentFile] = useState(null);
  const [documentStatus, setDocumentStatus] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const assistantCountRef = useRef(0);

  const meta = category ? CATEGORY_META[category] : null;

  useEffect(() => {
    if (panelState === "open" && unreadCount) {
      setUnreadCount(0);
    }
  }, [panelState, unreadCount]);

  useEffect(() => {
    const assistantCount = messages.filter((item) => item.role === "assistant").length;
    const previous = assistantCountRef.current;
    assistantCountRef.current = assistantCount;
    if (assistantCount <= previous) return;
    if (panelState === "minimized") {
      setUnreadCount((value) => value + (assistantCount - previous));
    }
  }, [messages, panelState]);

  const autosize = () => {
    const area = textareaRef.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${Math.min(area.scrollHeight, 96)}px`;
  };

  const handleSend = async (text) => {
    const normalized = String(text || draft || "").trim();
    if (!canAsk) return;
    if (category === COPILOT_CATEGORIES.DOCUMENT_ANALYSIS) {
      setDocumentStatus("Processando documento...");
    }
    const response = await sendMessage({ text: normalized, file: documentFile });
    if (response) {
      setDraft("");
      setDocumentFile(null);
      setDocumentStatus("");
      if (fileRef.current) fileRef.current.value = "";
      setTimeout(autosize, 0);
    } else if (category === COPILOT_CATEGORIES.DOCUMENT_ANALYSIS) {
      setDocumentStatus("Não foi possível interpretar o documento.");
    }
  };

  const handleQuickAction = (action) => {
    if (!action) return;
    if (action.action_type === "RESET_COMPANY") {
      clearCompany();
      return;
    }
    if (action.action_type === "RESET_CATEGORY" && action.target) {
      selectCategory(action.target);
      return;
    }
    if (action.action_type === "NAVIGATE" && action.target) {
      onNavigateRoute?.(action.target);
    }
  };

  const categoryIcon = category ? (CATEGORY_ICONS[category] || Bot) : Bot;
  const CategoryIcon = categoryIcon;

  if (!allowed) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50">
      <div className="pointer-events-auto">
        {panelState === "open" ? (
          <div className="mb-2 flex h-[600px] max-h-[calc(100vh-6rem)] w-[380px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur-sm" data-testid="copilot-panel">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-900 px-3 py-2 text-white">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Bot className="h-4 w-4" /> Copiloto eControle
                  </p>
                  <div className="mt-1">
                    {company ? (
                      <Badge variant="success" className="max-w-full gap-1 truncate border-emerald-300/70 bg-emerald-100 text-[11px] text-emerald-800">
                        <Building2 className="h-3 w-3" /> {company.razao_social}
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-slate-300">Selecione categoria para iniciar</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" className="rounded-md p-1 hover:bg-slate-700" onClick={minimize} aria-label="Minimizar" data-testid="copilot-minimize">
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1 hover:bg-slate-700"
                    onClick={resetAll}
                    aria-label="Fechar"
                    data-testid="copilot-close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
              {!category ? <CategoryStep onSelect={selectCategory} /> : null}

              {category ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-sm">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between"
                    onClick={() => selectCategory("")}
                    data-testid="copilot-change-category"
                  >
                    <span className="flex items-center gap-1.5">
                      <CategoryIcon className="h-3.5 w-3.5 text-indigo-500" />
                      Categoria: <strong>{CATEGORY_META[category].title}</strong>
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                </div>
              ) : null}

              {category && (requiresCompany || needsCompanySelection) ? (
                <CompanyStep
                  company={company}
                  companySearch={companySearch}
                  companyOptions={companyOptions}
                  companyLoading={companyLoading}
                  onSearch={setCompanySearch}
                  onSelect={selectCompany}
                />
              ) : null}

              {!canAsk && category && (requiresCompany || needsCompanySelection) ? (
                <p className="text-xs text-amber-700" data-testid="copilot-input-locked">
                  Selecione uma empresa para liberar o campo de pergunta manual.
                </p>
              ) : null}

              {canAsk ? (
                <div className="space-y-2" data-testid="copilot-step-input">
                  <div className="overflow-x-auto pb-1">
                    <div className="flex w-max flex-nowrap gap-2">
                      {(meta?.examples || []).map((example) => (
                        <Badge
                          key={example}
                          variant="secondary"
                          className="cursor-pointer whitespace-nowrap border-slate-300 bg-slate-100 text-[11px] hover:bg-slate-200"
                          onClick={() => handleSend(example)}
                          data-testid="copilot-example-chip"
                        >
                          {example}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <ScrollArea className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/70 p-2">
                <div className="space-y-3 pr-2">
                  {messages.map((message) => (
                    <div key={message.id}>
                      {message.role === "user" ? (
                        <div className="ml-auto w-fit max-w-[92%]">
                          <div className="rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-sm text-white shadow-sm">
                            {message.text}
                          </div>
                          <p className="mt-1 text-right text-xs text-slate-500">{messageTimestamp(message.id)}</p>
                        </div>
                      ) : (
                        <div>
                          <AssistantAnswer payload={message.payload} onQuickAction={handleQuickAction} />
                          <p className="ml-9 mt-1 text-xs text-slate-500">{messageTimestamp(message.id)}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  {sending ? (
                    <div className="flex items-start gap-2">
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
                          <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse [animation-delay:120ms]" />
                          <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse [animation-delay:240ms]" />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </ScrollArea>

              {error ? <p className="text-xs text-rose-700">{error}</p> : null}

              {category === COPILOT_CATEGORIES.DOCUMENT_ANALYSIS && documentStatus ? (
                <p className="text-xs text-slate-600" data-testid="copilot-document-status">{documentStatus}</p>
              ) : null}

              {canAsk ? (
                <div className="space-y-2">
                  {documentFile ? (
                    <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                      <span className="truncate">{documentFile.name}</span>
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-slate-200"
                        onClick={() => {
                          setDocumentFile(null);
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                        aria-label="Remover arquivo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : null}
                  <div className="flex items-end gap-2">
                    <label className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-100" data-testid="copilot-document-upload-container">
                      <Paperclip className="h-4 w-4" />
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        data-testid="copilot-document-upload"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          setDocumentFile(file);
                        }}
                      />
                    </label>
                    <Textarea
                      ref={textareaRef}
                      value={draft}
                      rows={1}
                      onChange={(event) => {
                        setDraft(event.target.value);
                        autosize();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleSend(draft);
                        }
                      }}
                      placeholder="Descreva a solicitação..."
                      className="min-h-[40px] max-h-24 resize-none rounded-2xl bg-white"
                      data-testid="copilot-manual-input"
                    />
                    <Button
                      type="button"
                      size="icon"
                      className="h-10 w-10 rounded-full bg-indigo-600 hover:bg-indigo-500"
                      onClick={() => handleSend(draft)}
                      disabled={sending || (!draft.trim() && !documentFile)}
                      data-testid="copilot-send"
                    >
                      <SendHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl transition hover:bg-slate-800"
          onClick={() => (panelState === "open" ? minimize() : open())}
          data-testid="copilot-launcher"
          aria-label="Abrir copiloto"
        >
          <MessageSquare className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}
