import { MapPin, Settings } from "lucide-react";

export const RISK_OPTIONS = [
  { key: "high", label: "Alto" },
  { key: "medium", label: "Médio" },
  { key: "low", label: "Baixo" },
  { key: "unmapped", label: "Sem mapeamento" },
];

export const CERT_OPTIONS = [
  { key: "vencendo", label: "Vencendo" },
  { key: "vencido", label: "Vencido" },
  { key: "valido", label: "Válido" },
  { key: "sem_certificado", label: "Sem certificado" },
];

export const PROCESS_TYPE_ICON = {
  BOMBEIROS: Settings,
  FUNCIONAMENTO: Settings,
  DIVERSOS: Settings,
  USO_DO_SOLO: MapPin,
  SANITARIO: Settings,
  ALVARA_SANITARIO: Settings,
};

export const TABLE_COLUMNS = [
  { id: "tipoDisplay", label: "Tipo" },
  { id: "empresa", label: "Empresa" },
  { id: "protocolo", label: "Protocolo" },
  { id: "data_solicitacao", label: "Data solicitação", isDate: true },
  { id: "municipio", label: "Município" },
  { id: "situacao", label: "Situação", isStatus: true },
  { id: "detalhes", label: "Detalhes" },
  { id: "obs", label: "OBS" },
];

export const SORT_OPTIONS = [
  { value: "urgencyScore", label: "Urgência", defaultDir: "desc", isNumber: true },
  { value: "data_solicitacao", label: "Data solicitação", defaultDir: "desc", isDate: true },
  { value: "empresa", label: "Empresa", defaultDir: "asc" },
  { value: "situacao", label: "Situação", defaultDir: "asc" },
];

export const DEFAULT_SORT = SORT_OPTIONS[0];
export const SECONDARY_SORT = SORT_OPTIONS[1];
