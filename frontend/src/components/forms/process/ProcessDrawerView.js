import { formatCanonicalLabel } from "@/lib/text";

export const buildProcessDrawerView = ({
  form,
  modal,
  companyOptions,
  processSituacoes,
  processServicos,
  processNotificacoes,
}) => {
  const selectedCompany = (Array.isArray(companyOptions) ? companyOptions : []).find(
    (item) => String(item.id) === String(form.company_id),
  );

  const companyRazaoSocial = String(
    form.company_razao_social || selectedCompany?.razao_social || "",
  ).trim();

  const statusLabel =
    (Array.isArray(processSituacoes) ? processSituacoes : []).find(
      (item) => item.value === form.situacao,
    )?.label || formatCanonicalLabel(form.situacao, "Ativo");

  const municipioLabel = formatCanonicalLabel(form.municipio, "\u2014");
  const servicoLabel =
    (Array.isArray(processServicos) ? processServicos : []).find(
      (item) => item.value === form.extra?.servico,
    )?.label || formatCanonicalLabel(form.extra?.servico, "\u2014");
  const notificacaoLabel =
    (Array.isArray(processNotificacoes) ? processNotificacoes : []).find(
      (item) => item.value === form.extra?.notificacao,
    )?.label || formatCanonicalLabel(form.extra?.notificacao, "\u2014");

  const companyLabel = formatCanonicalLabel(companyRazaoSocial, "Empresa");
  const companyInitials =
    companyLabel
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "EM";

  return {
    companyRazaoSocial,
    companyLabel,
    companyInitials,
    statusLabel,
    municipioLabel,
    servicoLabel,
    notificacaoLabel,
    headerEyebrow: `CADASTRO \u203a ${companyLabel} \u203a PROCESSO`,
    headerTitle: modal.mode === "edit" ? "Editar Processo" : "Novo Processo",
  };
};
