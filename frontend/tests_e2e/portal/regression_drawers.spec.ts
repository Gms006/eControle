import { expect, test } from "@playwright/test";

type Captures = {
  companyPatches: Array<Record<string, unknown>>;
  taxPatches: Array<Record<string, unknown>>;
  processPatches: Array<Record<string, unknown>>;
};

async function setupMockApi(page: Parameters<typeof test>[0]["page"]) {
  const captures: Captures = {
    companyPatches: [],
    taxPatches: [],
    processPatches: [],
  };

  const company = {
    id: "company-1",
    org_id: "org-1",
    cnpj: "12345678000190",
    razao_social: "Empresa Mock Ltda",
    nome_fantasia: "Empresa Mock",
    municipio: "Anápolis",
    uf: "GO",
    is_active: true,
    inscricao_municipal: "123",
    inscricao_estadual: "456",
    categoria: "Serviços",
    observacoes: "Observação antiga",
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

  await page.addInitScript(() => {
    window.localStorage.setItem("access_token", "mock-token");
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
        roles: [{ name: "ADMIN" }],
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
        servicos_sanitarios: [{ value: "licenciamento", label: "Licenciamento" }],
        notificacoes_sanitarias: [{ value: "sem_notificacao", label: "Sem Notificação" }],
      });
    }

    if (path === "/api/v1/companies/municipios" && method === "GET") {
      return fulfillJson(["Anápolis"]);
    }
    if (path === "/api/v1/companies" && method === "GET") {
      return fulfillJson([company]);
    }
    if (path === "/api/v1/companies/company-1" && method === "GET") {
      return fulfillJson(company);
    }
    if (path === "/api/v1/companies/company-1" && method === "PATCH") {
      captures.companyPatches.push(body);
      Object.assign(company, body);
      return fulfillJson(company);
    }

    if (path === "/api/v1/licencas" && method === "GET") {
      return fulfillJson([]);
    }
    if (path === "/api/v1/taxas" && method === "GET") {
      return fulfillJson([tax]);
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
      return fulfillJson([]);
    }
    if (path === "/api/v1/grupos/kpis" && method === "GET") {
      return fulfillJson({});
    }

    return fulfillJson({});
  });

  return captures;
}

test.describe("Portal regression drawers", () => {
  test("edita observação da empresa e envia patch", async ({ page }) => {
    const captures = await setupMockApi(page);
    await page.goto("/painel");

    await page.getByRole("button", { name: /^Empresas/i }).first().click();
    await page.getByTestId("company-edit-button").first().click();
    await expect(page.getByText("Editar Empresa")).toBeVisible();

    const obs = page.getByTestId("company-observacoes");
    await obs.fill("Observação nova da empresa");
    await page.getByRole("button", { name: "Salvar" }).first().click();

    await expect.poll(() => captures.companyPatches.length).toBe(1);
    expect(captures.companyPatches[0]?.observacoes).toBe("Observação nova da empresa");
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
    expect(String(captures.taxPatches[0]?.data_envio)).toContain("Impresso");
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
});
