import { expect, test } from "@playwright/test";

async function setupMockApi(page: Parameters<typeof test>[0]["page"]) {
  await page.addInitScript(() => {
    window.localStorage.setItem("access_token", "mock-token");
    window.localStorage.setItem("econtrole.empresas.viewMode", "detailed");
  });

  const companies = [
    {
      id: "company-1",
      org_id: "org-1",
      cnpj: "11.111.111/0001-11",
      razao_social: "Empresa Overview Ltda",
      nome_fantasia: "Overview",
      municipio: "Anápolis",
      situacao: "ativa",
      score_urgencia: 88,
      risco_consolidado: "HIGH",
      score_status: "OK",
      cnaes_principal: [{ code: "47.11-3-02", text: "Comércio varejista" }],
    },
  ];

  const overview = {
    company: companies[0],
    profile: {
      status_empresa: "ativa",
      porte: "ME",
      responsavel_fiscal: "Maria Fiscal",
      telefone: "62999999999",
      email: "fiscal@overview.test",
    },
    score: {
      risk_tier: "HIGH",
      score_urgencia: 88,
      score_status: "OK",
      score_updated_at: "2026-03-01T10:00:00Z",
    },
    certificate: {
      exists: true,
      status: "EXPIRING",
      validade: "2026-04-20T10:00:00Z",
      cert_id: "cert-1",
      fingerprint: "AA:BB",
      updated_at: "2026-03-21T11:00:00Z",
    },
    summary: {
      pending_taxes_count: 2,
      critical_licences_count: 1,
      open_processes_count: 1,
      certificate_status: "EXPIRING",
      next_due_items: [{ kind: "tax", label: "Taxa de Funcionamento", due_date: "2026-04-10", status: "em_aberto", urgency: "warning" }],
      has_alerts: true,
      risk_tier: "HIGH",
      score_urgencia: 88,
      score_status: "OK",
    },
    taxes: [{ id: "tax-1:taxa_funcionamento", tipo: "Taxa de Funcionamento", competencia: "2026-03", vencimento: "2026-04-10", valor: "500,00", status: "em_aberto", urgency: "warning" }],
    licences: [{ tipo: "Alvará Vigilância Sanitária", validade: "2026-04-15", status: "vencendo", origem: "dated", critical: true }],
    processes: [{ id: "proc-1", titulo: "Renovação", protocolo: "PROC-01", situacao: "pendente", ultima_atualizacao: "2026-03-31T10:00:00Z", responsavel: "Analista", stalled: false }],
    timeline: [{ kind: "due_tax", title: "Próximo vencimento: Taxa de Funcionamento", description: "em_aberto", happened_at: "2026-04-10", severity: "warning" }],
  };

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

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
    if (path === "/api/v1/companies/municipios" && method === "GET") return fulfillJson(["Anápolis"]);
    if (path === "/api/v1/companies" && method === "GET") return fulfillJson(companies);
    if (path === "/api/v1/companies/company-1/overview" && method === "GET") return fulfillJson(overview);
    if (path === "/api/v1/licencas" && method === "GET") return fulfillJson([]);
    if (path === "/api/v1/taxas" && method === "GET") return fulfillJson([]);
    if (path === "/api/v1/processos" && method === "GET") return fulfillJson([]);
    if (path === "/api/v1/certificados" && method === "GET") return fulfillJson([]);
    if (path === "/api/v1/grupos/kpis" && method === "GET") return fulfillJson({});
    return fulfillJson({});
  });
}

test("abre overview da empresa e renderiza blocos principais", async ({ page }) => {
  await setupMockApi(page);
  await page.goto("/painel");

  await page.getByTestId("nav-tab-empresas").first().click();
  await expect(page.getByTestId("companies-summary")).toBeVisible();
  await page.getByTestId("company-open-button").first().click();

  await expect(page.getByTestId("company-overview-drawer")).toBeVisible();
  await expect(page.getByTestId("company-overview-section-summary")).toBeVisible();

  await page.getByRole("tab", { name: "Cadastro" }).click();
  await expect(page.getByTestId("company-overview-section-cadastro")).toBeVisible();

  await page.getByRole("tab", { name: "Taxas" }).click();
  await expect(page.getByTestId("company-overview-section-taxes")).toBeVisible();

  await page.getByRole("tab", { name: "Licenças" }).click();
  await expect(page.getByTestId("company-overview-section-licences")).toBeVisible();

  await page.getByRole("tab", { name: "Processos" }).click();
  await expect(page.getByTestId("company-overview-section-processes")).toBeVisible();

  await page.getByRole("tab", { name: "Timeline" }).click();
  await expect(page.getByTestId("company-overview-section-timeline")).toBeVisible();
});
