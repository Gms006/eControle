import { Chip } from "@/components/Chip";
import {
  resolveTaxaTipo,
  resolveTaxaStatusEdicao,
  resolveTaxaStatusFila,
  resolveTaxaStatusGeral,
  resolveLicencaTipo,
  resolveLicencaStatus,
  resolveNaoExigidoMotivo,
  resolveProcessoTipo,
  resolveProcessoStatus,
  resolveProcessoUrgencia,
  resolveProcessoOperacao,
  resolveProcessoOrgao,
  resolveProcessoAlvara,
  resolveProcessoServico,
  resolveProcessoNotificacao,
  resolveEmpresaRisco,
  resolveEmpresaStatus,
  resolveEmpresaSituacaoTaxas,
  resolveEmpresaDebito,
  resolveCertificadoStatus,
  resolveCertificadoDias,
} from "@/lib/status";

function Badge({ resolved, value, size = "sm", dot = false, className = "" }) {
  if (value == null || value === "") return null;
  const { variant, label } = resolved;
  return (
    <Chip variant={variant} size={size} dot={dot} className={className}>
      {label}
    </Chip>
  );
}

export const TaxaTipoBadge = ({ tipo, ...props }) => (
  <Badge resolved={resolveTaxaTipo(tipo)} value={tipo} {...props} />
);

export const TaxaStatusBadge = ({ status, ...props }) => (
  <Badge resolved={resolveTaxaStatusEdicao(status)} value={status} {...props} />
);

export const TaxaFilaBadge = ({ status, ...props }) => (
  <Badge resolved={resolveTaxaStatusFila(status)} value={status} {...props} />
);

export const TaxaStatusGeralBadge = ({ status, ...props }) => (
  <Badge resolved={resolveTaxaStatusGeral(status)} value={status} {...props} />
);

export const LicencaTipoBadge = ({ tipo, ...props }) => (
  <Badge resolved={resolveLicencaTipo(tipo)} value={tipo} {...props} />
);

export const LicencaStatusBadge = ({ status, ...props }) => (
  <Badge resolved={resolveLicencaStatus(status)} value={status} {...props} />
);

export const NaoExigidoMotivoBadge = ({ motivo, ...props }) => (
  <Badge resolved={resolveNaoExigidoMotivo(motivo)} value={motivo} {...props} />
);

export const ProcessoTipoBadge = ({ tipo, ...props }) => (
  <Badge resolved={resolveProcessoTipo(tipo)} value={tipo} {...props} />
);

export const ProcessoStatusBadge = ({ status, ...props }) => (
  <Badge resolved={resolveProcessoStatus(status)} value={status} {...props} />
);

export const ProcessoUrgenciaBadge = ({ bucket, ...props }) => (
  <Badge resolved={resolveProcessoUrgencia(bucket)} value={bucket} {...props} />
);

export const ProcessoOperacaoBadge = ({ operacao, ...props }) => (
  <Badge resolved={resolveProcessoOperacao(operacao)} value={operacao} {...props} />
);

export const ProcessoOrgaoBadge = ({ orgao, ...props }) => (
  <Badge resolved={resolveProcessoOrgao(orgao)} value={orgao} {...props} />
);

export const ProcessoAlvaraBadge = ({ alvara, ...props }) => (
  <Badge resolved={resolveProcessoAlvara(alvara)} value={alvara} {...props} />
);

export const ProcessoServicoBadge = ({ servico, ...props }) => (
  <Badge resolved={resolveProcessoServico(servico)} value={servico} {...props} />
);

export const ProcessoNotificacaoBadge = ({ notificacao, ...props }) => (
  <Badge resolved={resolveProcessoNotificacao(notificacao)} value={notificacao} {...props} />
);

export const EmpresaRiscoBadge = ({ risco, ...props }) => (
  <Badge resolved={resolveEmpresaRisco(risco)} value={risco} {...props} />
);

export const EmpresaStatusBadge = ({ status, ...props }) => (
  <Badge resolved={resolveEmpresaStatus(status)} value={status} {...props} />
);

export const EmpresaSituacaoTaxasBadge = ({ situacao, ...props }) => (
  <Badge resolved={resolveEmpresaSituacaoTaxas(situacao)} value={situacao} {...props} />
);

export const EmpresaDebitoBadge = ({ debito, ...props }) => (
  <Badge resolved={resolveEmpresaDebito(debito)} value={debito} {...props} />
);

export const CertificadoStatusBadge = ({ status, ...props }) => (
  <Badge resolved={resolveCertificadoStatus(status)} value={status} {...props} />
);

export function CertificadoDiasBadge({ dias, size = "sm", className = "" }) {
  if (dias == null) return null;
  const { variant } = resolveCertificadoDias(dias);
  const numericDays = Number(dias);
  const label = numericDays < 0
    ? `Vencido ha ${Math.abs(numericDays)}d`
    : numericDays === 0
      ? "Vence hoje"
      : `Vence em ${numericDays}d`;
  return (
    <Chip variant={variant} size={size} className={className}>
      {label}
    </Chip>
  );
}

