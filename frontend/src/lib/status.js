import { normalizeText, normalizeTextLower, removeDiacritics } from "@/lib/text";
import { deriveStatusFromInstallment, formatInstallment, parseInstallment } from "@/lib/installment";

/**
 * status.js — eControle v2
 * Fonte central de verdade para cor e label de todos os domínios do portal.
 */

function key(raw) {
  if (raw == null) return "";
  return removeDiacritics(String(raw)).toLowerCase().trim().replace(/\s+/g, "_").replace(/-/g, "_");
}

function resolve(map, raw, fallbackLabel) {
  const k = key(raw);
  if (map[k]) return map[k];
  const normalizedLabel = String(raw ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const label = fallbackLabel ?? (normalizedLabel || "—");
  return { variant: "neutral", label };
}

function canonicalCandidates(raw) {
  const original = normalizeText(raw).trim();
  if (!original) return [""];
  const noDate = original.replace(/\s*[-–]?\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s*$/u, "").trim();
  const beforeDash = noDate.split(/\s[-–]\s/u)[0]?.trim() || noDate;
  const candidates = [key(original), key(noDate), key(beforeDash)];
  const deduped = [];
  for (const candidate of candidates) {
    if (candidate && !deduped.includes(candidate)) deduped.push(candidate);
  }
  return deduped.length > 0 ? deduped : [""];
}

const withAliases = (baseMap, aliases) => {
  const next = { ...baseMap };
  Object.entries(aliases).forEach(([from, to]) => {
    if (baseMap[to]) next[from] = baseMap[to];
  });
  return next;
};

// ---------------------------------------------------------------------------
// TAXAS
// ---------------------------------------------------------------------------

const TAXA_TIPO_MAP = withAliases(
  {
    tpi: { variant: "danger", label: "TPI" },
    publicidade: { variant: "indigo", label: "Publicidade" },
    localizacao_instalacao: { variant: "warning", label: "Localiz. / Instalação" },
    bombeiros: { variant: "fire", label: "Bombeiros" },
    func: { variant: "purple", label: "Funcionamento" },
    sanitaria: { variant: "teal", label: "Sanitária" },
    area_publica: { variant: "success", label: "Área pública" },
  },
  {
    taxa_funcionamento: "func",
    taxa_publicidade: "publicidade",
    taxa_vig_sanitaria: "sanitaria",
    taxa_localiz_instalacao: "localizacao_instalacao",
    taxa_ocup_area_publica: "area_publica",
    taxa_bombeiros: "bombeiros",
  },
);

const TAXA_STATUS_EDICAO_MAP = {
  em_aberto: { variant: "danger", label: "Em aberto" },
  parcelado: { variant: "warning", label: "Parcelado" },
  pago: { variant: "success", label: "Pago" },
  isento: { variant: "teal", label: "Isento" },
  nao_aplicavel: { variant: "indigo", label: "N/A" },
  pendente: { variant: "neutral", label: "Pendente" },
  "": { variant: "neutral", label: "Pendente" },
};

const TAXA_STATUS_FILA_MAP = {
  em_aberto: { variant: "danger", label: "Em aberto" },
  vencidas: { variant: "fire", label: "Vencidas" },
  vence_7_dias: { variant: "warning", label: "Vence em 7 dias" },
  sem_status: { variant: "neutral", label: "Sem status" },
  isentas: { variant: "teal", label: "Isentas" },
  parcelado_andamento: { variant: "warning", label: "Parcelado / andamento" },
  envio_pendente: { variant: "purple", label: "Envio pendente" },
};

const TAXA_STATUS_GERAL_MAP = {
  regular: { variant: "success", label: "Regular" },
  irregular: { variant: "danger", label: "Irregular" },
};

export function resolveTaxaTipo(tipo) {
  return resolve(TAXA_TIPO_MAP, tipo);
}

export function resolveTaxaStatusEdicao(status) {
  const k = key(status);
  return TAXA_STATUS_EDICAO_MAP[k] ?? TAXA_STATUS_EDICAO_MAP[""];
}

export function resolveTaxaStatusFila(status) {
  return resolve(TAXA_STATUS_FILA_MAP, status);
}

export function resolveTaxaStatusGeral(status) {
  return resolve(TAXA_STATUS_GERAL_MAP, status);
}

// ---------------------------------------------------------------------------
// LICENCAS
// ---------------------------------------------------------------------------

const LICENCA_TIPO_MAP = {
  sanitaria: { variant: "teal", label: "Sanitária" },
  cercon: { variant: "danger", label: "CerCon" },
  funcionamento: { variant: "purple", label: "Funcionamento" },
  uso_do_solo: { variant: "brown", label: "Uso do Solo" },
  ambiental: { variant: "success", label: "Ambiental" },
};

const LICENCA_STATUS_MAP = {
  possui: { variant: "success", label: "Possui" },
  definitivo: { variant: "success", label: "Definitivo" },
  vencido: { variant: "warning", label: "Vencido" },
  sujeito: { variant: "danger", label: "Sujeito" },
  nao_possui: { variant: "purple", label: "Não possui" },
  nao_exigido: { variant: "teal", label: "Não exigido" },
  isento: { variant: "teal", label: "Isento" },
  aguardando_documento: { variant: "info", label: "Ag. documento" },
  aguardando_vistoria: { variant: "warning", label: "Ag. vistoria" },
  aguardando_pagamento: { variant: "warning", label: "Ag. pagamento" },
  aguardando_regularizacao: { variant: "danger", label: "Ag. regularização" },
  aguardando_liberacao: { variant: "warning", label: "Ag. liberação" },
  em_analise: { variant: "warning", label: "Em análise" },
  notificacao: { variant: "fire", label: "Notificação" },
  ir_na_visa: { variant: "indigo", label: "Ir na VISA" },
};

const NAO_EXIGIDO_MOTIVO_MAP = {
  atividade_nao_exige: { variant: "teal", label: "Atividade não exige" },
  zoneamento_nao_aplica: { variant: "teal", label: "Zoneamento não aplica" },
  porte_dispensado: { variant: "teal", label: "Porte dispensado" },
  fase_pre_operacional: { variant: "warning", label: "Pré-operacional" },
  mei: { variant: "teal", label: "MEI" },
  endereco_administrativo_fiscal: { variant: "teal", label: "End. administrativo/fiscal" },
  outro: { variant: "neutral", label: "Outro" },
};

export function resolveLicencaTipo(tipo) {
  return resolve(LICENCA_TIPO_MAP, tipo);
}

export function resolveLicencaStatus(status) {
  return resolve(LICENCA_STATUS_MAP, status);
}

export function resolveNaoExigidoMotivo(motivo) {
  return resolve(NAO_EXIGIDO_MOTIVO_MAP, motivo);
}

// ---------------------------------------------------------------------------
// PROCESSOS
// ---------------------------------------------------------------------------

const PROCESSO_TIPO_MAP = withAliases(
  {
    diversos: { variant: "info", label: "Diversos" },
    funcionamento: { variant: "purple", label: "Funcionamento" },
    cercon: { variant: "fire", label: "CerCon" },
    uso_do_solo: { variant: "brown", label: "Uso do Solo" },
    alvara_sanitario: { variant: "teal", label: "Alv. Sanitário" },
  },
  {
    bombeiros: "cercon",
    sanitario: "alvara_sanitario",
  },
);

const PROCESSO_STATUS_MAP = {
  pendente: { variant: "indigo", label: "Pendente" },
  em_analise: { variant: "warning", label: "Em análise" },
  em_andamento: { variant: "warning", label: "Em andamento" },
  aguardando_documento: { variant: "info", label: "Ag. documento" },
  aguardando_vistoria: { variant: "warning", label: "Ag. vistoria" },
  aguardando_pagamento: { variant: "warning", label: "Ag. pagamento" },
  aguardando_regularizacao: { variant: "danger", label: "Ag. regularização" },
  aguardando_liberacao: { variant: "warning", label: "Ag. liberação" },
  concluido: { variant: "success", label: "Concluído" },
  licenciado: { variant: "success", label: "Licenciado" },
  notificacao: { variant: "fire", label: "Notificação" },
  indeferido: { variant: "fire", label: "Indeferido" },
  cancelado: { variant: "fire", label: "Cancelado" },
};

const PROCESSO_URGENCIA_MAP = {
  overdue: { variant: "fire", label: "Vencido" },
  due7: { variant: "warning", label: "Vence em 7 dias" },
  awaiting_payment: { variant: "danger", label: "Ag. pagamento" },
  in_analysis: { variant: "warning", label: "Em análise" },
  incomplete: { variant: "purple", label: "Incompleto" },
};

const PROCESSO_OPERACAO_MAP = {
  abertura: { variant: "success", label: "Abertura" },
  inscricao: { variant: "success", label: "Inscrição" },
  renovacao: { variant: "warning", label: "Renovação" },
  alteracao: { variant: "warning", label: "Alteração" },
  baixa: { variant: "danger", label: "Baixa" },
  restituicao: { variant: "purple", label: "Restituição" },
  cancel_de_tributos: { variant: "danger", label: "Cancel. de tributos" },
  retificacao: { variant: "warning", label: "Retificação" },
};

const PROCESSO_ORGAO_MAP = {
  prefeitura: { variant: "purple", label: "Prefeitura" },
  bombeiros: { variant: "fire", label: "Bombeiros" },
  vigilancia_sanitaria: { variant: "teal", label: "Vig. Sanitária" },
};

const PROCESSO_ALVARA_MAP = {
  sujeito: { variant: "danger", label: "Sujeito" },
  isento: { variant: "teal", label: "Isento" },
  nao_possui: { variant: "neutral", label: "Não possui" },
};

const PROCESSO_SERVICO_MAP = {
  licenciamento: { variant: "success", label: "Licenciamento" },
  "1º_alvara": { variant: "success", label: "1º Alvará" },
  "1o_alvara": { variant: "success", label: "1º Alvará" },
  renovacao: { variant: "warning", label: "Renovação" },
  vistoria: { variant: "info", label: "Vistoria" },
};

const PROCESSO_NOTIFICACAO_MAP = {
  sem_notificacao: { variant: "success", label: "Sem notificação" },
  notificado: { variant: "danger", label: "Notificado" },
  auto_infracao: { variant: "fire", label: "Auto de infração" },
};

export function resolveProcessoTipo(tipo) {
  return resolve(PROCESSO_TIPO_MAP, tipo);
}

export function resolveProcessoStatus(status) {
  return resolve(PROCESSO_STATUS_MAP, status);
}

export function resolveProcessoUrgencia(bucket) {
  return resolve(PROCESSO_URGENCIA_MAP, bucket);
}

export function resolveProcessoOperacao(operacao) {
  return resolve(PROCESSO_OPERACAO_MAP, operacao);
}

export function resolveProcessoOrgao(orgao) {
  return resolve(PROCESSO_ORGAO_MAP, orgao);
}

export function resolveProcessoAlvara(alvara) {
  return resolve(PROCESSO_ALVARA_MAP, alvara);
}

export function resolveProcessoServico(servico) {
  return resolve(PROCESSO_SERVICO_MAP, servico);
}

export function resolveProcessoNotificacao(notificacao) {
  return resolve(PROCESSO_NOTIFICACAO_MAP, notificacao);
}

// ---------------------------------------------------------------------------
// EMPRESAS
// ---------------------------------------------------------------------------

const EMPRESA_RISCO_MAP = {
  high: { variant: "danger", label: "Alto" },
  medium: { variant: "warning", label: "Médio" },
  low: { variant: "success", label: "Baixo" },
};

const EMPRESA_STATUS_MAP = {
  ativo: { variant: "success", label: "Ativo" },
  ativa: { variant: "success", label: "Ativa" },
  inativo: { variant: "warning", label: "Inativo" },
  inativa: { variant: "warning", label: "Inativa" },
};

const EMPRESA_SITUACAO_TAXAS_MAP = {
  regular: { variant: "success", label: "Regular" },
  irregular: { variant: "danger", label: "Irregular" },
};

const EMPRESA_DEBITO_MAP = {
  sem_debitos: { variant: "success", label: "Sem débitos" },
  possui_debito: { variant: "danger", label: "Possui débito" },
};

export function resolveEmpresaRisco(risco) {
  return resolve(EMPRESA_RISCO_MAP, risco);
}

export function resolveEmpresaStatus(status) {
  return resolve(EMPRESA_STATUS_MAP, status);
}

export function resolveEmpresaSituacaoTaxas(situacao) {
  return resolve(EMPRESA_SITUACAO_TAXAS_MAP, situacao);
}

export function resolveEmpresaDebito(debito) {
  return resolve(EMPRESA_DEBITO_MAP, debito);
}

// ---------------------------------------------------------------------------
// CERTIFICADOS
// ---------------------------------------------------------------------------

const CERTIFICADO_STATUS_MAP = withAliases(
  {
    valido: { variant: "success", label: "Válido" },
    vence_dentro_de_7_dias: { variant: "warning", label: "Vence em 7 dias" },
    vence_dentro_de_30_dias: { variant: "warning", label: "Vence em 30 dias" },
    vencido: { variant: "danger", label: "Vencido" },
    nao_possui: { variant: "neutral", label: "Não possui" },
  },
  {
    "válido": "valido",
    ok: "valido",
    alerta: "vence_dentro_de_7_dias",
    vencendo: "vence_dentro_de_7_dias",
  },
);

export function resolveCertificadoStatus(status) {
  return resolve(CERTIFICADO_STATUS_MAP, status);
}

export function resolveCertificadoDias(diasRestantes) {
  if (diasRestantes == null) return { variant: "neutral" };
  const d = Number(diasRestantes);
  if (!Number.isFinite(d)) return { variant: "neutral" };
  if (d < 0) return { variant: "danger" };
  if (d <= 30) return { variant: "warning" };
  return { variant: "success" };
}

// ---------------------------------------------------------------------------
// LEGADO E COMPATIBILIDADE
// ---------------------------------------------------------------------------

export const ALERT_STATUS_KEYWORDS = [
  "vencid",
  "vence",
  "nao_pago",
  "nao_pago",
  "negad",
  "indefer",
  "abert",
  "irregular",
  "pendente",
];

export const PROCESS_INACTIVE_KEYWORDS = [
  "concluido",
  "licenciado",
  "aprovado",
  "indeferido",
  "negado",
  "finalizado",
  "arquiv",
  "cancel",
  "baix",
  "encerr",
  "deferid",
  "liber",
  "emitid",
  "exped",
  "entreg",
];

export const PROCESS_FOCUS_KEYWORDS = [
  "andament",
  "pend",
  "aguard",
  "analise",
  "tram",
  "vistori",
  "process",
  "solicit",
  "enviad",
  "protocol",
  "fiscaliz",
  "document",
  "pagament",
  "taxa",
  "abert",
  "receb",
];

export const getStatusKey = (status) => key(status);

export const hasRelevantStatus = (status) => {
  const statusText = normalizeText(status).trim();
  if (!statusText || statusText === "*" || statusText === "-" || statusText === "—") {
    return false;
  }
  const statusKey = getStatusKey(statusText);
  return Boolean(statusKey && statusKey !== "*");
};

export const parseProgressFraction = (status) => {
  if (status === null || status === undefined) return null;
  const installment = parseInstallment(status);
  if (installment) return { current: installment.paid, total: installment.total };
  const text = normalizeText(status);
  const match = text.match(/(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const parseNumber = (value) => {
    const trimmed = value.replace(/\s+/g, "");
    const hasComma = trimmed.includes(",");
    const hasDot = trimmed.includes(".");
    const normalized = hasComma && hasDot ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  return { current: parseNumber(match[1]), total: parseNumber(match[2]) };
};

export const hasPendingFraction = (status) => {
  const fraction = parseProgressFraction(status);
  if (!fraction) return false;
  const { current, total } = fraction;
  if (!Number.isFinite(current) || !Number.isFinite(total)) return true;
  if (total <= 0) return true;
  return current < total;
};

export const isAlertStatus = (status) => {
  const k = key(status);
  if (!k) return false;
  if (k.includes("nao_se_aplica") || k.includes("n_a")) return false;
  if (hasPendingFraction(status)) return true;
  return ALERT_STATUS_KEYWORDS.some((keyword) => k.includes(keyword));
};

/**
 * Mantido para compatibilidade:
 * retorna objeto { variant, className? } como antes.
 */
export const resolveStatusClass = (status) => {
  const normalized = normalizeText(status).trim();
  if (!normalized || normalized === "*" || normalized === "-" || normalized === "—") {
    return { variant: "outline" };
  }
  const installment = parseInstallment(normalized);
  if (installment) {
    const derived = deriveStatusFromInstallment(installment.paid, installment.total);
    return { variant: derived === "paid" ? "success" : "warning" };
  }
  const candidates = canonicalCandidates(normalized);
  for (const map of [
    PROCESSO_STATUS_MAP,
    LICENCA_STATUS_MAP,
    TAXA_STATUS_EDICAO_MAP,
    TAXA_STATUS_FILA_MAP,
    TAXA_STATUS_GERAL_MAP,
    CERTIFICADO_STATUS_MAP,
  ]) {
    for (const candidate of candidates) {
      if (map[candidate]) return { variant: map[candidate].variant };
    }
  }
  const k = candidates[0] || "";
  if (k.includes("regular") && !k.includes("irregular")) return { variant: "success" };
  if (k.includes("irregular")) return { variant: "danger" };
  if (k.includes("venc")) return { variant: "warning" };
  if (k.includes("pago") && !k.includes("nao")) return { variant: "success" };
  if (k.includes("nao_pago") || k.includes("em_aberto")) return { variant: "danger" };
  if (k.includes("ativo")) return { variant: "success" };
  if (k.includes("inativo")) return { variant: "warning" };
  return { variant: "neutral" };
};

export const formatStatusDisplay = (status) => {
  const normalized = normalizeText(status);
  const trimmed = normalized.trim();
  if (!trimmed || trimmed === "*" || trimmed === "-" || trimmed === "—") return "—";
  const installment = parseInstallment(trimmed);
  if (installment) {
    const derived = deriveStatusFromInstallment(installment.paid, installment.total);
    if (derived === "paid") return "Pago";
    return `Parcelado ${formatInstallment(installment.paid, installment.total)}`;
  }
  const trailingDateMatch = trimmed.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\s*$/);
  const trailingDate = trailingDateMatch
    ? `${String(trailingDateMatch[1]).padStart(2, "0")}/${String(trailingDateMatch[2]).padStart(2, "0")}/${String(trailingDateMatch[3]).length === 2 ? `20${trailingDateMatch[3]}` : trailingDateMatch[3]}`
    : null;
  if (!trailingDate && /\s[-–]\s/.test(trimmed)) {
    return trimmed;
  }
  const candidates = canonicalCandidates(trimmed);
  for (const map of [
    PROCESSO_STATUS_MAP,
    LICENCA_STATUS_MAP,
    TAXA_STATUS_EDICAO_MAP,
    TAXA_STATUS_FILA_MAP,
    TAXA_STATUS_GERAL_MAP,
    CERTIFICADO_STATUS_MAP,
    LICENCA_TIPO_MAP,
    PROCESSO_TIPO_MAP,
    TAXA_TIPO_MAP,
    EMPRESA_STATUS_MAP,
    EMPRESA_SITUACAO_TAXAS_MAP,
    EMPRESA_DEBITO_MAP,
  ]) {
    for (const candidate of candidates) {
      if (map[candidate]) {
        if (trailingDate) return `${map[candidate].label} - ${trailingDate}`;
        return map[candidate].label;
      }
    }
  }
  return String(trimmed).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

export const isProcessStatusInactive = (status) => {
  const k = getStatusKey(status);
  if (!k) return false;
  return PROCESS_INACTIVE_KEYWORDS.some((keyword) => k.includes(keyword));
};

export const isProcessStatusActiveOrPending = (status) => {
  const k = getStatusKey(status);
  if (!k || k === "*" || k === "-" || k === "—") return false;
  if (isProcessStatusInactive(status)) return false;
  if (hasPendingFraction(status)) return true;
  return PROCESS_FOCUS_KEYWORDS.some((keyword) => k.includes(keyword));
};
