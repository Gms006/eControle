// src/lib/quickLinks.ts
import { removeDiacritics } from "@/lib/text";

export function onlyDigits(v: string = ""): string {
  return v.replace(/\D+/g, "");
}

export function normalizeIM(raw: string = ""): string {
  const base = (raw || "").split(" - ")[0];
  return onlyDigits(base);
}

let cartaoCnpjWindow: Window | null = null;
const CARTAO_CNPJ_TARGET = "econtrole_cnpj_reva_tab";

/**
 * Abre/reutiliza a aba do Cartão CNPJ já com ?cnpj=<digits> e copia o número.
 */
export async function openCartaoCNPJ(
  cnpjRaw: string,
  onToast?: (msg: string) => void,
) {
  const cnpj = onlyDigits(cnpjRaw || "");
  if (!cnpj || cnpj.length !== 14) {
    onToast?.("CNPJ inválido para abrir o Cartão CNPJ.");
    return;
  }
  try {
    await navigator.clipboard?.writeText(cnpj);
  } catch {
    /* silencioso */
  }

  const url = new URL(
    "https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp",
  );
  url.searchParams.set("cnpj", cnpj);

  onToast?.("CNPJ copiado — abrindo Cartão CNPJ");

  if (cartaoCnpjWindow && !cartaoCnpjWindow.closed) {
    cartaoCnpjWindow.location.href = url.toString();
    cartaoCnpjWindow.focus();
    return;
  }

  const opened = window.open(url.toString(), CARTAO_CNPJ_TARGET);
  if (opened) {
    cartaoCnpjWindow = opened;
    opened.focus();
    return;
  }

  onToast?.("Popup bloqueado. Libere popups para reutilizar a aba do Cartão CNPJ.");
}

export async function openCNDAnapolis(
  cnpjRaw: string,
  onToast?: (msg: string) => void,
) {
  const cnpj = onlyDigits(cnpjRaw || "");
  if (!cnpj || cnpj.length !== 14) {
    onToast?.("CNPJ inválido.");
    return;
  }
  try {
    await navigator.clipboard?.writeText(cnpj);
  } catch {
    /* ignore */
  }
  onToast?.("CNPJ copiado — abrindo Portal do Cidadão (Anápolis).");
  window.open(
    "https://portaldocidadao.anapolis.go.gov.br/",
    "_blank",
    "noopener,noreferrer",
  );
}

export async function openCAEAnapolis(
  imRaw: string,
  onToast?: (msg: string) => void,
) {
  const im = normalizeIM(imRaw);
  if (!im) {
    onToast?.("Inscrição Municipal inválida.");
    return;
  }
  try {
    await navigator.clipboard?.writeText(im);
  } catch {
    /* silencioso */
  }
  onToast?.("IM copiada — abrindo Portal do Cidadão (Anápolis).");
  window.open(
    "https://portaldocidadao.anapolis.go.gov.br/",
    "_blank",
    "noopener,noreferrer",
  );
}

const PREFEITURA_PORTAL_BY_MUNICIPIO: Record<string, string> = {
  "belo horizonte": "https://prefeitura.pbh.gov.br/",
  ceres: "https://ceres.go.gov.br/",
  pirenopolis: "https://pirenopolis.go.gov.br/",
  "corumba de goias": "https://corumbadegoias.go.gov.br/",
  niquelandia: "https://niquelandia.go.gov.br/",
  goianesia: "https://goianesia.go.gov.br/",
  "gameleira de goias": "https://www.gameleiradegoias.go.gov.br/home",
  cuiaba: "https://www.cuiaba.mt.gov.br/",
  silvania: "https://silvania.go.gov.br/",
  anapolis: "https://www.anapolis.go.gov.br/",
  abadiania: "https://www.abadiania.go.gov.br/",
  "rio branco": "https://www.riobranco.ac.gov.br/",
  uruacu: "https://uruacu.go.gov.br/",
  goianapolis: "https://goianapolis.go.gov.br/",
  coribe: "https://www.coribe.ba.gov.br/",
  catalao: "https://catalao.go.gov.br/",
  rubiataba: "https://rubiataba.go.gov.br/",
  rialma: "https://rialma.go.gov.br/",
  goiania: "https://www.goiania.go.gov.br/",
  uruana: "https://uruana.go.gov.br/",
  "abadia de goias": "https://abadiadegoias.go.gov.br/",
  trindade: "https://trindade.go.gov.br/",
  "valparaiso de goias": "https://valparaisodegoias.go.gov.br/",
  neropolis: "https://neropolis.go.gov.br/",
  itapaci: "https://itapaci.go.gov.br/",
  alexania: "https://alexania.go.gov.br/",
  mozarlandia: "https://mozarlandia.go.gov.br/",
  "vila propicio": "https://vilapropicio.go.gov.br/",
  "carmo do rio verde": "https://www.carmodorioverde.go.gov.br/",
  jaragua: "https://jaragua.go.gov.br/",
};

const normalizeMunicipioPortalKey = (value: string = "") =>
  removeDiacritics(String(value || "").toLowerCase())
    .replace(/\s*-\s*[a-z]{2}\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

export function openPortalPrefeitura(
  municipioRaw: string,
  onToast?: (msg: string) => void,
) {
  const key = normalizeMunicipioPortalKey(municipioRaw || "");
  const url = key ? PREFEITURA_PORTAL_BY_MUNICIPIO[key] : undefined;
  if (!url) {
    onToast?.("Portal da Prefeitura não mapeado para este município.");
    return;
  }
  onToast?.("Abrindo portal da Prefeitura.");
  window.open(url, "_blank", "noopener,noreferrer");
}
