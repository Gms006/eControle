import { expect, test } from "@playwright/test";

async function setupMockApi(page: Parameters<typeof test>[0]["page"]) {
  await page.addInitScript(() => {
    window.localStorage.setItem("access_token", "mock-token");
  });

  const notifications = [
    {
      id: "notif-1",
      org_id: "org-1",
      user_id: null,
      event_type: "job.licence_scan_full.finished",
      severity: "info",
      title: "Scan de licencas finalizado",
      message: "Run concluida com sucesso.",
      entity_type: "licence_scan_run",
      entity_id: "run-1",
      route_path: "/painel?tab=taxas",
      dedupe_key: "job:licence_scan_full:run-1:done",
      metadata_json: {},
      read_at: null,
      created_at: "2026-04-02T10:00:00Z",
    },
    {
      id: "notif-2",
      org_id: "org-1",
      user_id: null,
      event_type: "job.receitaws_bulk_sync.finished",
      severity: "warning",
      title: "Bulk sync cancelado",
      message: "Run cancelada.",
      entity_type: "receitaws_bulk_sync_run",
      entity_id: "run-2",
      route_path: null,
      dedupe_key: "job:receitaws_bulk_sync:run-2:cancelled",
      metadata_json: {},
      read_at: null,
      created_at: "2026-04-02T09:30:00Z",
    },
  ];

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
    if (path === "/api/v1/companies" && method === "GET") return fulfillJson([]);
    if (path === "/api/v1/licencas" && method === "GET") return fulfillJson([]);
    if (path === "/api/v1/taxas" && method === "GET") return fulfillJson([]);
    if (path === "/api/v1/processos" && method === "GET") return fulfillJson([]);
    if (path === "/api/v1/certificados" && method === "GET") return fulfillJson([]);
    if (path === "/api/v1/grupos/kpis" && method === "GET") return fulfillJson({});

    if (path === "/api/v1/notificacoes/unread-count" && method === "GET") {
      const unreadCount = notifications.filter((item) => !item.read_at).length;
      return fulfillJson({ unread_count: unreadCount });
    }
    if (path === "/api/v1/notificacoes" && method === "GET") {
      return fulfillJson({ items: notifications, total: notifications.length, limit: 20, offset: 0 });
    }
    if (path.startsWith("/api/v1/notificacoes/") && path.endsWith("/read") && method === "POST") {
      const id = path.split("/").slice(-2, -1)[0];
      const target = notifications.find((item) => item.id === id);
      if (!target) return fulfillJson({ detail: "Notification not found" }, 404);
      target.read_at = "2026-04-02T10:05:00Z";
      return fulfillJson({ id: target.id, read_at: target.read_at });
    }

    return fulfillJson({});
  });
}

test.describe("Notification Center MVP", () => {
  test("topbar exibe contador, lista notificacoes e navega por route_path", async ({ page }) => {
    await setupMockApi(page);
    await page.goto("/painel");

    await expect(page.getByTestId("topbar-notifications-button")).toBeVisible();
    await expect(page.getByTestId("topbar-notifications-unread")).toContainText("2");

    await page.getByTestId("topbar-notifications-button").click();
    await expect(page.getByTestId("notifications-panel")).toBeVisible();
    await expect(page.getByTestId("notifications-tab-unread")).toBeVisible();
    await expect(page.getByTestId("notifications-tab-read")).toBeVisible();
    await expect(page.getByTestId("notification-item")).toHaveCount(2);

    await page.getByTestId("notification-open-route").first().click();
    await expect(page).toHaveURL(/\/painel\?tab=taxas/);
    await expect(page.getByTestId("topbar-notifications-unread")).toContainText("1");

    await page.getByTestId("topbar-notifications-button").click();
    await expect(page.getByTestId("notification-item")).toHaveCount(1);

    await page.getByTestId("notification-mark-read").first().click();
    await expect(page.getByTestId("topbar-notifications-unread")).toHaveCount(0);
    await page.getByTestId("notifications-tab-read").click();
    await expect(page.getByTestId("notification-item")).toHaveCount(2);
  });
});
