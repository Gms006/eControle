import React from "react";
import { Textarea } from "@/components/ui/textarea";

export default function ProcessObservacaoTab({ form, fieldClass, FieldBlock, SectionHeader, update }) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Observação" subtitle="Notas internas do processo" />
      <FieldBlock label="Observação">
        <Textarea
          rows={8}
          data-testid="process-obs"
          value={form.obs}
          onChange={(e) => update({ obs: e.target.value })}
          className={fieldClass}
        />
      </FieldBlock>
    </div>
  );
}
