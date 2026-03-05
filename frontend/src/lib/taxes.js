import { toCanonicalIsoDate, toUiBrDate } from "./date.js";

export const TAX_DATA_ENVIO_METHOD_OPTIONS = [
  "Pessoal",
  "Nº Escritório",
  "E-mail",
  "Office Boy (impresso)",
];

const METHOD_CANONICAL_BY_KEY = new Map([
  ["pessoal", "pessoal"],
  ["n_escritorio", "n_escritorio"],
  ["numero_escritorio", "n_escritorio"],
  ["email", "email"],
  ["e_mail", "email"],
  ["impresso", "office_boy_impresso"],
  ["officeboy", "office_boy_impresso"],
  ["office_boy", "office_boy_impresso"],
  ["office_boy_impresso", "office_boy_impresso"],
]);

const METHOD_LABEL_BY_CANONICAL = new Map([
  ["pessoal", "Pessoal"],
  ["n_escritorio", "Nº Escritório"],
  ["email", "E-mail"],
  ["office_boy_impresso", "Office Boy (impresso)"],
]);

const DATE_AND_METHODS_RE = /^\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})(?:\s*-\s*(.+))?\s*$/;
const TAX_FIELDS_REQUIRING_ENVIO = [
  "func",
  "publicidade",
  "sanitaria",
  "localizacao_instalacao",
  "area_publica",
  "bombeiros",
  "tpi",
  "iss",
  "taxa_funcionamento",
  "taxa_publicidade",
  "taxa_vig_sanitaria",
  "taxa_localiz_instalacao",
  "taxa_ocup_area_publica",
  "taxa_bombeiros",
];

function unique(values) {
  return [...new Set(values)];
}

function methodKey(value) {
  const text = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[º°]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return text;
}

function canonicalMethod(value) {
  const key = methodKey(value);
  return METHOD_CANONICAL_BY_KEY.get(key) ?? null;
}

function methodLabel(value) {
  const canonical = canonicalMethod(value);
  return canonical ? METHOD_LABEL_BY_CANONICAL.get(canonical) ?? null : null;
}

function parseMethods(methodsRaw) {
  const text = String(methodsRaw ?? "").trim();
  if (!text) return [];
  return unique(
    text
      .split(/\s*(?:;|,|\/)\s*/g)
      .map((part) => methodLabel(part))
      .filter(Boolean),
  );
}

export function parseDataEnvio(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return { date: "", methods: [] };

  const match = text.match(DATE_AND_METHODS_RE);
  if (!match) {
    const dateOnly = toUiBrDate(text);
    return { date: dateOnly || "", methods: [] };
  }

  const date = toUiBrDate(match[1]);
  if (!date) return { date: "", methods: [] };

  return {
    date,
    methods: parseMethods(match[2]),
  };
}

export function formatDataEnvio(date, methods) {
  const dateBr = toUiBrDate(date);
  if (!dateBr) return null;

  const normalizedMethods = unique((methods ?? []).map((item) => methodLabel(item)).filter(Boolean));
  if (normalizedMethods.length === 0) return dateBr;

  return `${dateBr} - ${normalizedMethods.join("; ")}`;
}

export function toDateInputFromDataEnvio(raw) {
  const parsed = parseDataEnvio(raw);
  return toCanonicalIsoDate(parsed.date) ?? "";
}

export function displayDataEnvio(raw) {
  const parsed = parseDataEnvio(raw);
  return formatDataEnvio(parsed.date, parsed.methods) ?? "";
}

export function getDataEnvioDisplay(raw) {
  const parsed = parseDataEnvio(raw);
  return {
    date: parsed.date || "",
    methods: parsed.methods,
    methodLabel: parsed.methods.join("; ") || "",
  };
}

export function isTaxStatusEmAberto(status) {
  const key = methodKey(status).replace(/_/g, " ").replace(/\s+/g, "_");
  return key === "em_aberto";
}

export function isTaxStatusPendente(status) {
  const key = methodKey(status).replace(/_/g, " ").replace(/\s+/g, "_");
  return key === "pendente";
}

export function isEnvioPendente(taxa) {
  const hasPendingTax = TAX_FIELDS_REQUIRING_ENVIO.some(
    (field) => isTaxStatusEmAberto(taxa?.[field]) || isTaxStatusPendente(taxa?.[field]),
  );
  const hasEnvioDate = Boolean(parseDataEnvio(taxa?.data_envio).date);
  return hasPendingTax && !hasEnvioDate;
}
