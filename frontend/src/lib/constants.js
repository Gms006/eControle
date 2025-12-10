export const MUNICIPIO_ALL = "__ALL__";
export const PROCESS_ALL = "__PROCESS_ALL__";

export const TAB_BACKGROUNDS = {
  painel: "bg-transparent",
  empresas: "bg-transparent",
  certificados: "bg-transparent",
  licencas: "bg-transparent",
  taxas: "bg-transparent",
  processos: "bg-transparent",
  uteis: "bg-transparent",
};

export const TAB_SHORTCUTS = {
  1: "painel",
  2: "empresas",
  3: "certificados",
  4: "licencas",
  5: "taxas",
  6: "processos",
  7: "uteis",
};

export const RESPONSAVEL_FISCAL_OPTIONS = [
  { value: "Carla", label: "Carla" },
  { value: "Denise", label: "Denise" },
  { value: "Fernando", label: "Fernando" },
];

export const RESPONSAVEL_FISCAL_VALUES = RESPONSAVEL_FISCAL_OPTIONS.map((item) => item.value);

export const DEFAULT_LICENCA_TIPOS = [
  "Sanitária",
  "CERCON",
  "Funcionamento",
  "Uso do Solo",
  "Ambiental",
];

export const TAXA_COLUMNS = [
  { key: "tpi", label: "TPI" },
  { key: "func", label: "Funcionamento" },
  { key: "publicidade", label: "Publicidade" },
  { key: "sanitaria", label: "Sanitária" },
  { key: "localizacao_instalacao", label: "Localização/Instalação" },
  { key: "area_publica", label: "Área Pública" },
  { key: "bombeiros", label: "Bombeiros" },
  { key: "status_geral", label: "Status geral" },
];

export const TAXA_TYPE_KEYS = TAXA_COLUMNS.filter((column) => column.key !== "status_geral").map(
  (column) => column.key,
);

export const TAXA_ALERT_KEYS = [...TAXA_TYPE_KEYS, "status_geral"];

export const TAXA_SEARCH_KEYS = [...TAXA_COLUMNS.map((column) => column.key), "data_envio"];
