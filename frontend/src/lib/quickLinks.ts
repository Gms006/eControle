// src/lib/quickLinks.ts
export function onlyDigits(v: string = ""): string {
  return v.replace(/\D+/g, "");
}

export function normalizeIM(raw: string = ""): string {
  const base = (raw || "").split(" - ")[0];
  return onlyDigits(base);
}

/**
 * Abre a página do Cartão CNPJ já com ?cnpj=<digits> e copia o número.
 * Não bloqueia a UI; abre em nova aba.
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

  onToast?.(`CNPJ copiado — abrindo Cartão CNPJ`);
  window.open(url.toString(), "_blank", "noopener,noreferrer");
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
