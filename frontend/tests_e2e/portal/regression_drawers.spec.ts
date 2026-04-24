import { expect, test } from "@playwright/test";

type Captures = {
  companyPatches: Array<Record<string, unknown>>;
  taxPatches: Array<Record<string, unknown>>;
  processPatches: Array<Record<string, unknown>>;
  licencePatches: Array<Record<string, unknown>>;
};

async function setupMockApi(
  page: Parameters<typeof test>[0]["page"],
  options?: {
    role?: "ADMIN" | "DEV" | "VIEW";
    licencas?: Array<Record<string, unknown>>;
    companies?: Array<Record<string, unknown>>;
    taxas?: Array<Record<string, unknown>>;
  }
) {
  const captures: Captures = {
    companyPatches: [],
    taxPatches: [],
    processPatches: [],
    licencePatches: [],
  };
  const role = options?.role ?? "ADMIN";

  const company = {
    id: "company-1",
    org_id: "org-1",
    cnpj: "12345678000190",
    razao_social: "Empresa Mock Ltda",
    nome_fantasia: "Empresa Mock",
    fs_dirname: "Empresa Mock Pasta",
    municipio: "Anápolis",
    uf: "GO",
    is_active: true,
    inscricao_municipal: "123",
    inscricao_estadual: "456",
    categoria: "Serviços",
    observacoes: "Observação antiga",
    sanitary_complexity: "PENDENTE_REVISAO",
    address_usage_type: "PENDENTE_REVISAO",
    address_location_type: "PENDENTE_REVISAO",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  const tax = {
    id: "tax-1",
    org_id: "org-1",
    company_id: "company-1",
    empresa: "Empresa Mock Ltda",
    cnpj: "12.345.678/0001-90",
    municipio: "Anápolis",
    data_envio: "05/02/2026 - E-mail",
    taxa_funcionamento: "isento",
    taxa_publicidade: "isento",
    taxa_vig_sanitaria: "isento",
    taxa_localiz_instalacao: "isento",
    taxa_ocup_area_publica: "isento",
    taxa_bombeiros: "isento",
    tpi: "isento",
    vencimento_tpi: "10/03",
    status_taxas: "regular",
  };

  const process = {
    id: "process-1",
    org_id: "org-1",
    company_id: "company-1",
    empresa: "Empresa Mock Ltda",
    cnpj: "12.345.678/0001-90",
    municipio: "Anápolis",
    process_type: "DIVERSOS",
    protocolo: "PROC-001",
    data_solicitacao: "2026-02-01",
    situacao: "pendente",
    obs: "Obs inicial",
    extra: { operacao: "abertura", orgao: "prefeitura" },
  };

  const certificado = {
    id: "cert-1",
    org_id: "org-1",
    company_id: "company-1",
    cert_id: "cert-1",
    sha1_fingerprint: "AA:BB:CC:DD:EE",
    titular: "Empresa Mock Ltda",
    cnpj: "12.345.678/0001-90",
    valido_de: "2026-01-01T00:00:00Z",
    valido_ate: "2026-03-10T00:00:00Z",
    dias_restantes: 6,
    situacao: "ALERTA",
  };
  const licencasPayload = options?.licencas ?? [];
  const companiesPayload = options?.companies ?? [company];
  const taxasPayload = options?.taxas ?? [tax];

  await page.addInitScript(() => {
    window.localStorage.setItem("access_token", "mock-token");
    // @ts-expect-error helper de teste
    window.__ECONTROLE_CERTHUB_BASE_URL = "https://certhub.mock.local";
    // @ts-expect-error helper de teste
    window.__ECONTROLE_CERTHUB_CERTS_PATH = "/certificados";
    // @ts-expect-error helper de teste
    window.__lastOpenUrl = null;
    const originalOpen = window.open.bind(window);
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      // @ts-expect-error helper de teste
      window.__lastOpenUrl = String(url || "");
      return originalOpen(url as string, target, features);
    }) as typeof window.open;
  });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const bodyText = request.postData() || "{}";
    const body = bodyText ? JSON.parse(bodyText) : {};

    const fulfillJson = (payload: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });

    if (path === "/api/v1/auth/me" && method === "GET") {
      return fulfillJson({
        id: "user-1",
        org_id: "org-1",
        email: "admin@mock.local",
        roles: [{ name: role }],
      });
    }

    if (path === "/api/v1/meta/enums" && method === "GET") {
      return fulfillJson({
        situacao_processos: [
          { value: "pendente", label: "Pendente" },
          { value: "concluido", label: "Concluído" },
        ],
        operacoes_diversos: [{ value: "abertura", label: "Abertura" }],
        orgaos_diversos: [{ value: "prefeitura", label: "Prefeitura" }],
        alvaras_funcionamento: [{ value: "sujeito", label: "Sujeito" }],
        alvara_funcionamento_kinds: [
          { value: "DEFINITIVO", label: "Definitivo" },
          { value: "CONDICIONADO", label: "Condicionado" },
          { value: "PROVISORIO", label: "Provisório" },
          { value: "PENDENTE_REVISAO", label: "Pendente Revisão" },
        ],
        sanitary_complexities: [
          { value: "BAIXA", label: "Baixa" },
          { value: "MEDIA", label: "Média" },
          { value: "ALTA", label: "Alta" },
          { value: "NAO_APLICAVEL", label: "Não Aplicável" },
          { value: "PENDENTE_REVISAO", label: "Pendente Revisão" },
        ],
        address_usage_types: [
          { value: "FISCAL", label: "Fiscal" },
          { value: "ADMINISTRATIVO", label: "Administrativo" },
          { value: "OPERACIONAL", label: "Operacional" },
          { value: "MISTO", label: "Misto" },
          { value: "PENDENTE_REVISAO", label: "Pendente Revisão" },
        ],
        address_location_types: [
          { value: "ESCRITORIO_CONTABIL", label: "Escritório Contábil" },
          { value: "ENDERECO_PROPRIO", label: "Endereço Próprio" },
          { value: "ENDERECO_TERCEIRO", label: "Endereço de Terceiro" },
          { value: "PENDENTE_REVISAO", label: "Pendente Revisão" },
        ],
        servicos_sanitarios: [{ value: "licenciamento", label: "Licenciamento" }],
        notificacoes_sanitarias: [{ value: "sem_notificacao", label: "Sem Notificação" }],
      });
    }

    if (path === "/api/v1/companies/municipios" && method === "GET") {
      return fulfillJson(["Anápolis"]);
    }
    if (path === "/api/v1/companies" && method === "GET") {
      return fulfillJson(companiesPayload);
    }
    if (path === "/api/v1/companies/company-1" && method === "GET") {
      return fulfillJson(company);
    }
    if (path.startsWith("/api/v1/companies/") && method === "PATCH") {
      captures.companyPatches.push(body);
      Object.assign(company, body);
      return fulfillJson(company);
    }

    if (path === "/api/v1/licencas" && method === "GET") {
      return fulfillJson(licencasPayload);
    }
    if (/^\/api\/v1\/licencas\/[^/]+\/item$/.test(path) && method === "PATCH") {
      captures.licencePatches.push(body);
      return fulfillJson({ ...licencasPayload[0], ...body });
    }
    if (path === "/api/v1/taxas" && method === "GET") {
      return fulfillJson(taxasPayload);
    }
    if (path === "/api/v1/taxas/tax-1" && method === "PATCH") {
      captures.taxPatches.push(body);
      Object.assign(tax, body);
      return fulfillJson(tax);
    }

    if (path === "/api/v1/processos" && method === "GET") {
      return fulfillJson([process]);
    }
    if (path === "/api/v1/processos/process-1" && method === "GET") {
      return fulfillJson(process);
    }
    if (path === "/api/v1/processos/process-1" && method === "PATCH") {
      captures.processPatches.push(body);
      Object.assign(process, body);
      return fulfillJson(process);
    }
    if (path === "/api/v1/processos/process-1/obs-history" && method === "GET") {
      return fulfillJson([]);
    }

    if (path === "/api/v1/certificados" && method === "GET") {
      return fulfillJson([certificado]);
    }
    if (path === "/api/v1/grupos/kpis" && method === "GET") {
      return fulfillJson({});
    }

    return fulfillJson({});
  });

  return captures;
}

test.describe("Portal regression drawers", () => {
  test("licenças agregadas priorizam validade_br e mantêm DD/MM sem inversão", async ({ page }) => {
    await setupMockApi(page, {
      licencas: [
        {
          id: "lic-agg-1",
          org_id: "org-1",
          company_id: "company-1",
          company_name: "Empresa Mock Ltda",
          company_razao_social: "Empresa Mock Ltda",
          company_cnpj: "12.345.678/0001-90",
          company_municipio: "Anápolis",
          cercon: "possui",
          alvara_vig_sanitaria: "possui",
          alvara_funcionamento: "nao_possui",
          licenca_ambiental: "possui",
          certidao_uso_solo: "possui",
          raw: {
            source_kind_cercon: "dated",
            validade_cercon: "2027-03-09",
            validade_cercon_br: "09/03/2027",
            source_kind_alvara_vig_sanitaria: "definitivo",
            source_kind_certidao_uso_solo: "dated",
            validade_certidao_uso_solo: "2026-12-11",
          },
        },
      ],
    });
    await page.goto("/painel");
    await page.getByRole("button", { name: /^Licenças/i }).first().click();
    await page.getByRole("button", { name: "Por Tipo" }).click();

    await expect(page.getByText("09/03/2027")).toBeVisible();
    await expect(page.getByText("03/09/2027")).toHaveCount(0);
    await expect(page.getByText("Pendente revisão")).toBeVisible();
  });

  test("certificados renderiza dado real e aciona deep link de instalar", async ({ page }) => {
    await setupMockApi(page);
    await page.goto("/painel");

    await page.getByRole("button", { name: /^Certificados/i }).first().click();
    await expect(page.getByText("Empresa Mock Ltda").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Instalar" }).first()).toBeEnabled();

    await page.getByRole("button", { name: "Instalar" }).first().click();
    const lastOpenUrl = await page.evaluate(() => {
      // @ts-expect-error helper de teste
      return window.__lastOpenUrl;
    });
    expect(String(lastOpenUrl)).toContain("/certificados?install=AA%3ABB%3ACC%3ADD%3AEE");
    expect(String(lastOpenUrl)).toMatch(/^https:\/\/certhub\.(mock\.)?local\//);
  });

  test("oculta registros de empresa inativa na aba Taxas", async ({ page }) => {
    await setupMockApi(page, {
      companies: [
        {
          id: "company-1",
          org_id: "org-1",
          cnpj: "12345678000190",
          razao_social: "Empresa Mock Ltda",
          nome_fantasia: "Empresa Mock",
          is_active: true,
        },
      ],
      taxas: [
        {
          id: "tax-active",
          org_id: "org-1",
          company_id: "company-1",
          empresa: "Empresa Mock Ltda",
          cnpj: "12.345.678/0001-90",
          taxa_funcionamento: "isento",
          status_taxas: "regular",
        },
        {
          id: "tax-inactive",
          org_id: "org-1",
          company_id: "7c8b5e96-4260-4c4c-bc54-62b000000000",
          empresa: "Empresa Inativa",
          cnpj: "99.999.999/0001-99",
          taxa_funcionamento: "em_aberto",
          status_taxas: "irregular",
        },
      ],
    });
    await page.goto("/painel");
    await page.getByRole("button", { name: /^Taxas/i }).first().click();

    await expect(page.getByText("Empresa Mock Ltda").first()).toBeVisible();
    await expect(page.getByText("Empresa não vinculada (ID 7c8b5e96-4260-4c4c-bc54-62b000000000)")).toHaveCount(0);
    await expect(page.getByText("Empresa Inativa")).toHaveCount(0);
  });

  test("edita observação da empresa no drawer", async ({ page }) => {
    await setupMockApi(page);
    await page.goto("/painel");

    await page.getByRole("button", { name: /^Empresas/i }).first().click();
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("econtrole:open-company", { detail: { mode: "edit", companyId: "company-1" } }));
    });
    const obs = page.locator('[data-testid="company-observacoes"]:visible').last();
    await expect(obs).toBeVisible();
    await expect(obs).toHaveValue("Observação antiga");
  });

  test("edita campos regulatórios estruturados da empresa", async ({ page }) => {
    const captures = await setupMockApi(page);
    await page.goto("/painel");

    await page.getByRole("button", { name: /^Empresas/i }).first().click();
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("econtrole:open-company", { detail: { mode: "edit", companyId: "company-1" } }));
    });

    await page.getByLabel("Complexidade Sanitária").selectOption("ALTA");
    await page.getByLabel("Uso do Endereço").selectOption("OPERACIONAL");
    await page.getByLabel("Local/Natureza do Endereço").selectOption("ENDERECO_PROPRIO");
    await page.getByRole("button", { name: "Salvar" }).first().click();

    await expect.poll(() => captures.companyPatches.length).toBe(1);
    expect(captures.companyPatches[0]?.sanitary_complexity).toBe("ALTA");
    expect(captures.companyPatches[0]?.address_usage_type).toBe("OPERACIONAL");
    expect(captures.companyPatches[0]?.address_location_type).toBe("ENDERECO_PROPRIO");
  });

  test("edita Apelido (Pasta) da empresa e confirma persistência ao reabrir", async ({ page }) => {
    const captures = await setupMockApi(page);
    await page.goto("/painel");

    await page.getByRole("button", { name: /^Empresas/i }).first().click();
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("econtrole:open-company", { detail: { mode: "edit", companyId: "company-1" } }));
    });

    const fsInput = page.getByTestId("company-fs-dirname").last();
    await expect(fsInput).toHaveValue("Empresa Mock Pasta");
    await fsInput.fill("Empresa Mock Pasta Atualizada");
    await page.getByRole("button", { name: "Salvar" }).first().click();

    await expect.poll(() => captures.companyPatches.length).toBe(1);
    expect(captures.companyPatches[0]?.fs_dirname).toBe("Empresa Mock Pasta Atualizada");

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("econtrole:open-company", { detail: { mode: "edit", companyId: "company-1" } }));
    });
    await expect(page.getByTestId("company-fs-dirname").last()).toHaveValue("Empresa Mock Pasta Atualizada");
  });

  test("perfil VIEW não vê ações de edição de empresa", async ({ page }) => {
    await setupMockApi(page, { role: "VIEW" });
    await page.goto("/painel");

    await expect(page.getByRole("button", { name: "+ Novo" })).toHaveCount(0);
    await page.getByRole("button", { name: /^Empresas/i }).first().click();
    await expect(page.getByTestId("company-edit-button")).toHaveCount(0);
  });

  test("edita taxa com métodos de envio e status normalizado", async ({ page }) => {
    const captures = await setupMockApi(page);
    await page.goto("/painel");

    await page.getByRole("button", { name: /^Taxas/i }).first().click();
    await page.getByTestId("tax-edit-button").first().click();
    await expect(page.getByText("Editar Taxas")).toBeVisible();

    await page.getByTestId("tax-envio-date").fill("2026-03-05");
    await page.getByTestId("tax-envio-method-trigger").click();
    await page.getByRole("menuitemcheckbox", { name: "Pessoal" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Impresso" }).click();
    await page.getByTestId("tax-envio-method-trigger").click({ force: true });

    await page.getByTestId("tax-status-taxa_funcionamento").selectOption("em_aberto");
    await page.getByRole("button", { name: "Salvar" }).first().click();

    await expect.poll(() => captures.taxPatches.length).toBe(1);
    expect(captures.taxPatches[0]?.taxa_funcionamento).toBe("em_aberto");
    expect(String(captures.taxPatches[0]?.data_envio)).toContain("05/03/2026");
    expect(String(captures.taxPatches[0]?.data_envio)).toContain("Pessoal");
    expect(String(captures.taxPatches[0]?.data_envio).toLowerCase()).toContain("impresso");
  });

  test("edita processo e envia obs no patch", async ({ page }) => {
    const captures = await setupMockApi(page);
    await page.goto("/painel");

    await page.getByRole("button", { name: /^Processos/i }).first().click();
    await page.getByTestId("process-edit-button").first().click();
    await expect(page.getByText("Editar Processo")).toBeVisible();

    await page.getByTestId("process-obs").fill("OBS atualizada via E2E");
    await page.getByRole("button", { name: "Salvar" }).first().click();

    await expect.poll(() => captures.processPatches.length).toBe(1);
    expect(captures.processPatches[0]?.obs).toBe("OBS atualizada via E2E");
  });

  test("edita licença de funcionamento com tipo explícito do alvará", async ({ page }) => {
    const captures = await setupMockApi(page, {
      licencas: [
        {
          id: "lic-1",
          licence_id: "lic-1",
          licence_field: "alvara_funcionamento",
          org_id: "org-1",
          company_id: "company-1",
          company_name: "Empresa Mock Ltda",
          company_razao_social: "Empresa Mock Ltda",
          company_cnpj: "12.345.678/0001-90",
          company_municipio: "Anápolis",
          tipo: "FUNCIONAMENTO",
          status: "nao_possui",
          valid_until: null,
          alvara_funcionamento_kind: "PENDENTE_REVISAO",
          raw: {
            source_kind_alvara_funcionamento: "dated",
          },
        },
      ],
    });
    await page.goto("/painel");
    await page.getByRole("button", { name: /^Licenças/i }).first().click();
    await page.getByRole("button", { name: "Detalhes" }).first().click();
    await expect(page.getByText("Edição rápida de licença")).toBeVisible();
    await page.getByLabel("Tipo do alvará").click();
    await page.getByRole("option", { name: "Condicionado" }).click();
    await page.getByRole("button", { name: "Salvar" }).last().click();

    await expect.poll(() => captures.licencePatches.length).toBe(1);
    expect(captures.licencePatches[0]?.alvara_funcionamento_kind).toBe("CONDICIONADO");
  });
});
