import { test, expect } from "@playwright/test";

test("real stack: upload and persistence on desktop", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#connection")).toContainText("Chưa kết nối model");
  await expect(page.locator("#welcome")).toBeVisible();
  const fixtureTitle = `history-browser-${Date.now()}`;
  const created = await page.request.post("/api/v1/sessions", {
    data: { title: fixtureTitle },
  });
  expect(created.ok()).toBeTruthy();
  await page.reload();
  const historyRow = page
    .locator(".session-row")
    .filter({ hasText: fixtureTitle })
    .first();
  await historyRow.click();
  await page.locator("#chat-options summary").click();
  await page.locator("#pin-chat").click();
  await expect(page.locator("#pin-chat")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await expect(
    page.locator(".history-group").filter({ hasText: "ĐÃ GHIM" }),
  ).toBeVisible();
  await historyRow.hover();
  await page
    .locator(`.session-item`)
    .filter({
      has: page.locator(".session-row").filter({ hasText: fixtureTitle }),
    })
    .first()
    .getByRole("button", {
      name: `Lưu trữ hội thoại ${fixtureTitle}`,
      exact: true,
    })
    .click();
  await page.locator("#history-archived").click();
  await expect(
    page.locator(".session-row").filter({ hasText: fixtureTitle }),
  ).toBeVisible();
  await historyRow.hover();
  await page
    .locator(".session-item")
    .filter({ hasText: fixtureTitle })
    .getByRole("button", {
      name: `Khôi phục hội thoại ${fixtureTitle}`,
      exact: true,
    })
    .click();
  await page.locator("#history-active").click();
  await expect(
    page.locator(".session-row").filter({ hasText: fixtureTitle }).first(),
  ).toBeVisible();
  await page.locator("#new-chat").click();
  await page.locator("#open-documents").click();
  await expect(page.locator("#documents-panel")).toBeVisible();
  await page.getByRole("button", { name: "Đóng bảng tài liệu" }).click();
  await expect(page.locator("#documents-panel")).toBeHidden();
  await page.locator("#open-sidebar").click();
  await expect(page.locator("#sidebar")).toBeHidden();
  await page.locator("#open-sidebar").click();
  await expect(page.locator("#sidebar")).toBeVisible();
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.locator("#theme-toggle").click();
  await page.screenshot({
    path: "../artifacts/ui-desktop.png",
    fullPage: true,
  });
  await page.locator("#attach-file").click();
  await page.locator("#file-input").setInputFiles({
    name: "browser-fixture.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Browser smoke fixture. Refund period is thirty days."),
  });
  const doc = page
    .locator(".document-row")
    .filter({ hasText: "browser-fixture.txt" });
  await expect(doc).toContainText("Sẵn sàng", { timeout: 15000 });
  await expect(doc.locator("input")).toBeChecked();
  await page.reload();
  await expect(doc).toContainText("Sẵn sàng");
  await expect(page.locator("#connection")).toContainText("Chưa kết nối model");
  await page.locator("#composer").fill("hello");
  await expect(page.locator("#send")).toBeDisabled();
  expect(errors).toEqual([]);
});

test("real stack: mobile drawers, keyboard and no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#connection")).toContainText("Chưa kết nối model");
  await page.screenshot({ path: "../artifacts/ui-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Mở danh sách hội thoại" }).click();
  await expect(page.locator("#sidebar")).toHaveClass(/open/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#scrim")).toBeHidden();
  await expect(page.locator("#open-sidebar")).toBeFocused();
  await page.locator("#open-documents").click();
  await expect(page.locator("#documents-panel")).toHaveClass(/open/);
  await page.keyboard.press("Escape");
  await page.locator("#composer").fill("dòng đầu");
  await page.locator("#composer").press("Shift+Enter");
  await expect(page.locator("#composer")).toHaveValue("dòng đầu\n");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("explicit API fixture: streaming, sources, safe text and reload", async ({
  page,
}) => {
  // Isolated test fixtures, never an application model fallback.
  let history = [],
    postCount = 0;
  const source = {
    chunk_id: "chunk-1",
    name: "source.txt",
    page: 1,
    version: 1,
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data;
    if (path.endsWith("/health")) data = { model_configured: true };
    else if (path.endsWith("/documents") || path.endsWith("/projects"))
      data = { items: [] };
    else if (path.endsWith("/sessions"))
      data =
        route.request().method() === "POST"
          ? { id: "session-1", title: "hello" }
          : { items: postCount ? [{ id: "session-1", title: "hello" }] : [] };
    else if (path.endsWith("/sessions/session-1"))
      data = { id: "session-1", title: "hello", project_id: null };
    else if (path.endsWith("/sources/chunk-1"))
      data = { ...source, text: "<script>unsafe</script> original excerpt" };
    else if (path.endsWith("/messages") && route.request().method() === "GET")
      data = { items: history };
    else if (path.endsWith("/messages")) {
      postCount++;
      history = [
        { role: "user", content: "hello", status: "completed" },
        {
          role: "assistant",
          content: "Tiếng Việt <img src=x onerror=alert(1)>",
          status: "completed",
          sources: [source],
        },
      ];
      await route.fulfill({
        contentType: "text/event-stream",
        body: `event: sources\ndata: ${JSON.stringify({ items: [source] })}\n\nevent: delta\ndata: ${JSON.stringify({ text: history[1].content })}\n\nevent: done\ndata: {"message_id":"message-1"}\n\n`,
      });
      return;
    } else throw new Error(`Unexpected fixture URL ${path}`);
    await route.fulfill({ json: data });
  });
  await page.goto("/");
  await expect(page.locator("#connection")).toContainText(
    "Sẵn sàng trò chuyện",
  );
  await page.locator("#composer").fill("hello");
  await page.locator("#composer").press("Enter");
  await expect(page.locator(".message.assistant")).toContainText(
    "Tiếng Việt <img",
  );
  await expect(page.locator("#stop")).toBeHidden();
  await expect(page.locator(".message.assistant .source-link")).toContainText(
    "1 nguồn tham khảo",
  );
  expect(postCount).toBe(1);
  expect(await page.locator(".message-content img").count()).toBe(0);
  await page.locator("#open-documents").click();
  await page.locator(".source-card button").click();
  await expect(page.locator(".source-excerpt")).toContainText(
    "<script>unsafe</script>",
  );
  expect(await page.locator(".source-excerpt script").count()).toBe(0);
  await page.reload();
  await page.locator(".session-row").click();
  await expect(page.locator(".message.assistant")).toContainText("Tiếng Việt");
});

test("explicit API fixture: offline backend and failed ingestion", async ({
  page,
}) => {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 503, json: { detail: "offline" } }),
  );
  await page.goto("/");
  await expect(page.locator("#connection")).toContainText(
    "Không kết nối được dịch vụ",
  );
  await expect(page.locator("#retry-connection")).toBeVisible();
  await page.unroute("**/api/v1/**");
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/health")
      ? { model_configured: false }
      : path.endsWith("/projects")
        ? { items: [] }
        : path.endsWith("/sessions")
          ? {
              items: [
                { id: "fixture-session", title: "scan chat", project_id: null },
              ],
            }
          : path.endsWith("/sessions/fixture-session")
            ? { id: "fixture-session", title: "scan chat", project_id: null }
            : path.endsWith("/messages")
              ? { items: [] }
              : {
                  items: [
                    {
                      id: "failed",
                      name: "scan.pdf",
                      version: 1,
                      status: "failed",
                      error: "PDF scan cần module OCR.",
                      bindings: [
                        {
                          id: "failed-link",
                          session_id: "fixture-session",
                          project_id: null,
                        },
                      ],
                    },
                  ],
                };
    return route.fulfill({ json: data });
  });
  await page.goto("/?session=fixture-session");
  await page.locator("#open-documents").click();
  await expect(page.locator(".document-row")).toContainText("Xử lý thất bại");
  await expect(page.locator(".document-row input")).toBeDisabled();
  await expect(page.locator(".document-row .document-error")).toContainText(
    "OCR",
  );
});
