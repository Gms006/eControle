// src/lib/quickLinks.ts
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
