import React from "react";
import { Input } from "@/components/ui/input";
import { maskCnpj, maskCpf, normalizeDigits } from "@/lib/masks";

export default function ProcessCompanyField({
  modalMode,
  processType,
  form,
  setForm,
  companyOptions,
  companyRazaoSocial,
  fieldClass,
  FieldBlock,
}) {
  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const maskDocument = (value) => {
    const digits = normalizeDigits(value || "");
    if (digits.length <= 11) return maskCpf(digits);
    return maskCnpj(digits);
  };

  const renderCompanySelect = () => (
    <select
      className={fieldClass}
      value={form.company_id}
      onChange={(e) => {
        const companyId = e.target.value;
        const selected = companyOptions.find((item) => item.id === companyId);
        setForm((prev) => ({
          ...prev,
          company_id: companyId,
          municipio: selected?.municipio || prev.municipio,
        }));
      }}
    >
      <option value="">Selecione</option>
      {companyOptions.map((item) => (
        <option key={item.id} value={item.id}>
          {(item.razao_social || "Empresa")} - {maskDocument(item.cnpj || item.company_cpf)}
        </option>
      ))}
    </select>
  );

  if (modalMode === "create" && processType === "DIVERSOS") {
    return (
      <>
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={form.empresa_nao_cadastrada === true}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                empresa_nao_cadastrada: e.target.checked,
                company_id: e.target.checked ? "" : prev.company_id,
                company_cnpj: e.target.checked ? prev.company_cnpj : "",
                company_razao_social: e.target.checked ? prev.company_razao_social : "",
              }))
            }
          />
          Empresa não cadastrada
        </label>
        {form.empresa_nao_cadastrada ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FieldBlock label="CPF/CNPJ" required>
              <Input
                className={fieldClass}
                value={maskDocument(form.company_cnpj)}
                onChange={(e) => update({ company_cnpj: normalizeDigits(e.target.value).slice(0, 14) })}
              />
            </FieldBlock>
            <FieldBlock label="Razão Social" required>
              <Input
                className={fieldClass}
                value={form.company_razao_social}
                onChange={(e) => update({ company_razao_social: e.target.value })}
              />
            </FieldBlock>
          </div>
        ) : (
          renderCompanySelect()
        )}
      </>
    );
  }

  if (modalMode === "create") {
    return renderCompanySelect();
  }

  return (
    <Input
      value={companyRazaoSocial || form.company_id || "Empresa não cadastrada"}
      className={fieldClass}
      disabled
    />
  );
}
