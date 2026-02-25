import dayjs from "dayjs";
import { normalizeText, parsePtDate, removeDiacritics } from "@/lib/text";

export const PROCESS_DIVERSOS_LABEL = "Diversos";
export const DIVERSOS_OPERACAO_ALL = "__PROCESS_DIVERSOS_ALL__";
export const DIVERSOS_OPERACAO_SEM = "__PROCESS_DIVERSOS_SEM_OPERACAO__";

export const PROCESS_BASE_COLUMNS = [
  { key: "protocolo", label: "Protocolo", copyable: true },
  { key: "data_solicitacao", label: "Data de Solicitação" },
  { key: "situacao", label: "Situação", isStatus: true },
];

export const PROCESS_DATE_COLUMNS = new Set([
  "data_solicitacao",
  "prazo",
  "data_val",
]);

export const formatProcessDate = (value) => {
  const normalized = normalizeText(value).trim();
  if (normalized === "") return "—";

  const parsedPtDate = parsePtDate(normalized);
  if (parsedPtDate) {
    return dayjs(parsedPtDate).format("DD/MM/YYYY");
  }

  const parsed = dayjs(normalized);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : "—";
};

const normalizeProcessColumnKey = (value) =>
  removeDiacritics(String(value ?? "").toLowerCase()).replace(/[^a-z0-9]+/g, "_");

const PROCESS_EXTRA_COLUMNS = {
  diversos: [
    { key: "operacao", label: "Operação" },
    { key: "orgao", label: "Órgão" },
  ],
  bombeiros: [{ key: "tpi", label: "TPI" }],
  funcionamento: [{ key: "alvara", label: "Alvará" }],
  alvara_de_funcionamento: [{ key: "alvara", label: "Alvará" }],
  uso_do_solo: [
    { key: "inscricao_imobiliaria", label: "Inscrição Imobiliária", copyable: true },
  ],
  sanitario: [
    { key: "taxa", label: "Taxa" },
    { key: "servico", label: "Serviço" },
    { key: "notificacao", label: "Notificação" },
    { key: "data_val", label: "Data Val" },
  ],
  alvara_sanitario: [
    { key: "servico", label: "Serviço" },
    { key: "notificacao", label: "Notificação" },
    { key: "data_val", label: "Data Val" },
  ],
};

const PROCESS_BASE_CANONICAL = [
  { keywords: ["divers"], label: "Diversos" },
  { keywords: ["funcion"], label: "Funcionamento" },
  { keywords: ["alvara", "funcion"], label: "Funcionamento" },
  { keywords: ["bombeir"], label: "Bombeiros" },
  { keywords: ["cercon"], label: "Bombeiros" },
  { keywords: ["uso", "solo"], label: "Uso do Solo" },
  { keywords: ["ambient"], label: "Licença Ambiental" },
  { keywords: ["licenc", "ambient"], label: "Licença Ambiental" },
  { keywords: ["alvara", "sanit"], label: "Alvará Sanitário" },
  { keywords: ["sanit"], label: "Alvará Sanitário" },
];

export const normalizeProcessType = (proc) => {
  const rawValue =
    typeof proc === "string"
      ? proc
      : typeof proc?.tipo === "string"
        ? proc.tipo
        : undefined;
  const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
  return trimmed !== "" ? trimmed : "Sem tipo";
};

export const getProcessBaseType = (value) => {
  const normalized = normalizeProcessType(value);
  const [base] = normalized.split(" - ");
  const trimmed = base.trim();
  if (trimmed === "") {
    return normalized;
  }
  const normalizedKey = removeDiacritics(trimmed.toLowerCase());
  const canonical = PROCESS_BASE_CANONICAL.find(({ keywords }) =>
    keywords.every((keyword) => normalizedKey.includes(keyword)),
  );
  return canonical ? canonical.label : trimmed;
};

export const buildDiversosOperacaoKey = (operacao) => {
  const text = normalizeText(operacao).trim();
  if (text === "") {
    return DIVERSOS_OPERACAO_SEM;
  }
  return removeDiacritics(text).toLowerCase();
};

export const getDiversosOperacaoLabel = (operacao) => {
  const text = normalizeText(operacao).trim();
  return text !== "" ? text : "Sem operação informada";
};

export const resolveProcessExtraColumns = (proc) => {
  const extras = [];
  const seen = new Set();
  const pushColumn = (column) => {
    if (!column || !column.key || seen.has(column.key)) {
      return;
    }
    seen.add(column.key);
    extras.push(column);
  };

  const includeColumns = (key) => {
    if (!key) return;
    const columns = PROCESS_EXTRA_COLUMNS[key];
    if (Array.isArray(columns)) {
      columns.forEach(pushColumn);
    }
  };

  const tipoReferencia = proc?.tipoBase || proc?.tipoNormalizado || proc?.tipo;
  const normalized = normalizeProcessColumnKey(tipoReferencia);
  if (normalized) {
    includeColumns(normalized);
    if (extras.length === 0) {
      if (normalized.includes("sanitario")) {
        includeColumns("sanitario");
      } else if (normalized.includes("uso") && normalized.includes("solo")) {
        includeColumns("uso_do_solo");
      } else if (normalized.includes("funcion")) {
        includeColumns("funcionamento");
      } else if (normalized.includes("divers")) {
        includeColumns("diversos");
      } else if (normalized.includes("bombeir")) {
        includeColumns("bombeiros");
      } else if (normalized.includes("alvara") && normalized.includes("sanit")) {
        includeColumns("alvara_sanitario");
      }
    }
  }

  return extras;
};
