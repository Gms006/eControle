import { removeDiacritics } from "@/lib/text";

const LOWER_WORDS = new Set(["da", "de", "do", "das", "dos", "e"]);
const UPPER_WORDS = new Set(["LTDA", "ME", "EPP", "S/A", "EIRELI", "MEI"]);

const MUNICIPIO_DISPLAY_MAP = {
  abadia: "Abadia",
  abadiania: "Abadiânia",
  alexania: "Alexânia",
  "aparecida de goiania": "Aparecida de Goiânia",
  anapolis: "Anápolis",
  catalao: "Catalão",
  ceres: "Ceres",
  "carmo do rio verde": "Carmo do Rio Verde",
  corumba: "Corumbá",
  "cuiaba - mt": "Cuiabá - MT",
  gameleira: "Gameleira de Goiás",
  "gameleira de goias": "Gameleira de Goiás",
  goianapolis: "Goianápolis",
  goianesia: "Goianésia",
  goiania: "Goiânia",
  itapaci: "Itapaci",
  jaragua: "Jaraguá",
  mozarlandia: "Mozarlândia",
  neropolis: "Nerópolis",
  niquelandia: "Niquelândia",
  pirenopolis: "Pirenópolis",
  rialma: "Rialma",
  rubiataba: "Rubiataba",
  "rio branco - ac": "Rio Branco - AC",
  "senador canedo": "Senador Canedo",
  silvania: "Silvânia",
  trindade: "Trindade",
  uruacu: "Uruaçu",
  uruana: "Uruana",
  "valparaiso de goias": "Valparaíso de Goiás",
  "vila propicio (zona rural)": "Vila Propício (zona rural)",
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
