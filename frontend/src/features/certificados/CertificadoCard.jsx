import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CopyableIdentifier from "@/components/CopyableIdentifier";
import StatusBadge from "@/components/StatusBadge";

const DATE_REGEX = /(\d{2}\/\d{2}\/\d{4})/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const extractDateLabel = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const match = value.match(DATE_REGEX);
  if (match) {
    return match[1];
  }
  return value.trim();
};

const parseDateValue = (value) => {
  if (!value) {
    return null;
  }
  const label = extractDateLabel(value);
  const parts = label.split("/");
  if (parts.length !== 3) {
    return null;
  }
  const [day, month, year] = parts.map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return null;
  }
  return new Date(year, month - 1, day);
};

const buildPrazoLabel = (diasRestantes) => {
  if (diasRestantes === null || diasRestantes === undefined) {
    return "—";
  }
  if (diasRestantes === 0) {
    return "Hoje";
  }
  if (diasRestantes > 0) {
    return diasRestantes === 1 ? "1 dia" : `${diasRestantes} dias`;
  }
  const abs = Math.abs(diasRestantes);
  return abs === 1 ? "Há 1 dia" : `Há ${abs} dias`;
};

const resolveDiasRestantesFromCertificado = (certificado) => {
  const directValue = certificado?.diasRestantes ?? certificado?.dias_restantes;
  if (Number.isFinite(directValue)) {
    return Math.round(directValue);
  }
  if (typeof directValue === "string") {
    const parsed = Number(directValue.trim());
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }
  return null;
};

export default function CertificadoCard({ certificado }) {
  const [todayKey, setTodayKey] = useState(() => new Date().toDateString());

  useEffect(() => {
    const update = () => setTodayKey(new Date().toDateString());
    update();
    const interval = setInterval(update, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const titular = certificado?.titular ?? "";
  const validoDe = extractDateLabel(certificado?.validoDe ?? certificado?.valido_de ?? "");
  const validoAte = extractDateLabel(certificado?.validoAte ?? certificado?.valido_ate ?? "");
  const senha =
    certificado?.senha ??
    certificado?.senha_certificado ??
    certificado?.senhaCertificado ??
    certificado?.senha_cert ??
    certificado?.password ??
    "";
  
  // Debug: log da senha
  if (import.meta.env.DEV && certificado?.id) {
    console.log(`[CertificadoCard] ID: ${certificado.id}, Senha:`, {
      raw_senha: certificado?.senha,
      calculated_senha: senha,
      all_fields: {
        senha: certificado?.senha,
        senha_certificado: certificado?.senha_certificado,
        senhaCertificado: certificado?.senhaCertificado,
        senha_cert: certificado?.senha_cert,
        password: certificado?.password,
      },
    });
  }
  
  const situacao = certificado?.situacao ?? "";
  const cpfCnpj =
    certificado?.cnpj ??
    certificado?.cpf ??
    certificado?.cpfCnpj ??
    certificado?.documento ??
    certificado?.document;

  const diasRestantes = useMemo(() => {
    const target = parseDateValue(certificado?.validoAte ?? "");
    if (target) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffMs = target.getTime() - start.getTime();
      return Math.round(diffMs / MS_PER_DAY);
    }
    return resolveDiasRestantesFromCertificado(certificado);
  }, [certificado, todayKey]);

  const prazoLabel = useMemo(() => buildPrazoLabel(diasRestantes), [diasRestantes]);

  return (
    <Card className="shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-800 flex flex-col gap-1">
          <span className="font-semibold text-slate-900">{titular || "Sem titular"}</span>
          <span className="text-xs text-slate-500">Válido de {validoDe || "—"} até {validoAte || "—"}</span>
        </CardTitle>
        <div className="mt-2">
          <StatusBadge status={situacao} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        <CopyableIdentifier label="CPF/CNPJ" value={cpfCnpj} />
        <CopyableIdentifier label="Senha" value={senha} isPassword={true} />
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Prazo para vencimento</div>
          <div className="text-base font-semibold text-slate-900">{prazoLabel}</div>
        </div>
      </CardContent>
    </Card>
  );
}
