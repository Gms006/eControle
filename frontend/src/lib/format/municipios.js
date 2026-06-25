import { removeDiacritics } from "@/lib/format/strings";

const LOWER_WORDS = new Set(["da", "de", "do", "das", "dos", "e"]);
const UPPER_WORDS = new Set(["LTDA", "ME", "EPP", "S/A", "EIRELI", "MEI"]);

const MUNICIPIO_DISPLAY_MAP = {
  "abadia de goias": "Abadia de Goi\u00e1s",
  abadia: "Abadia",
  abadiania: "Abadi\u00e2nia",
  alexania: "Alex\u00e2nia",
  "aparecida de goiania": "Aparecida de Goi\u00e2nia",
  anapolis: "An\u00e1polis",
  "belo horizonte": "Belo Horizonte",
  coribe: "Coribe",
  "corumba de goias": "Corumb\u00e1 de Goi\u00e1s",
  catalao: "Catal\u00e3o",
  ceres: "Ceres",
  "carmo do rio verde": "Carmo do Rio Verde",
  corumba: "Corumb\u00e1",
  cuiaba: "Cuiab\u00e1",
  "cuiaba - mt": "Cuiab\u00e1 - MT",
  gameleira: "Gameleira de Goi\u00e1s",
  "gameleira de goias": "Gameleira de Goi\u00e1s",
  goianapolis: "Goian\u00e1polis",
  goianesia: "Goian\u00e9sia",
  goiania: "Goi\u00e2nia",
  itapaci: "Itapaci",
  jaragua: "Jaragu\u00e1",
  mozarlandia: "Mozarl\u00e2ndia",
  neropolis: "Ner\u00f3polis",
  niquelandia: "Niquel\u00e2ndia",
  pirenopolis: "Piren\u00f3polis",
  rialma: "Rialma",
  rubiataba: "Rubiataba",
  "rio branco - ac": "Rio Branco - AC",
  "rio branco": "Rio Branco",
  "senador canedo": "Senador Canedo",
  silvania: "Silv\u00e2nia",
  trindade: "Trindade",
  uruacu: "Urua\u00e7u",
  uruana: "Uruana",
  "valparaiso de goias": "Valpara\u00edso de Goi\u00e1s",
  "vila propicio (zona rural)": "Vila Prop\u00edcio (zona rural)",
  "belo horizonte - mg": "Belo Horizonte - MG",
};

const normalizeSpaces = (value) => String(value ?? "").trim().replace(/\s+/g, " ");

const normalizeMunicipioKey = (value) =>
  removeDiacritics(normalizeSpaces(value).toLowerCase())
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();

const titleCaseMunicipio = (value) =>
  normalizeSpaces(value)
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (index > 0 && LOWER_WORDS.has(word)) return word;
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");

export const normalizeTitleCase = (value) => {
  const text = normalizeSpaces(value);
  if (!text) return "";
  return text
    .split(" ")
    .map((word, index) => {
      const upper = word.toUpperCase();
      if (UPPER_WORDS.has(upper)) return upper;
      if (index > 0 && LOWER_WORDS.has(upper.toLowerCase())) return upper.toLowerCase();
      return upper.charAt(0) + upper.slice(1).toLowerCase();
    })
    .join(" ");
};

export const normalizeMunicipio = (value) => {
  const text = normalizeSpaces(value);
  if (!text) return "";
  return normalizeMunicipioKey(text);
};

export const formatMunicipioDisplay = (value) => {
  const normalized = normalizeMunicipio(value);
  if (!normalized) return "";

  if (MUNICIPIO_DISPLAY_MAP[normalized]) {
    return MUNICIPIO_DISPLAY_MAP[normalized];
  }

  const [cidade, uf] = normalized.split(" - ");
  const cidadeFmt = titleCaseMunicipio(cidade);
  if (!uf) return cidadeFmt;
  return `${cidadeFmt} - ${uf.toUpperCase()}`;
};

export const normalizeEmail = (value) => {
  const text = normalizeSpaces(value);
  return text.includes("@") ? text : "";
};

export const extractPrimaryPhoneDigits = (value) => {
  const text = String(value ?? "");
  const matches = text.match(/\d+/g) || [];
  const merged = matches.join("");
  for (let i = 0; i < merged.length; i += 1) {
    const eleven = merged.slice(i, i + 11);
    if (eleven.length === 11) return eleven;
    const ten = merged.slice(i, i + 10);
    if (ten.length === 10) return ten;
  }
  return "";
};
