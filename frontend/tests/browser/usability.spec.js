import { test, expect } from "@playwright/test";

test("global search opens saved project chats and rename survives reload", async ({
  page,
}) => {
  const name = `usability-${Date.now()}`;
  const project = await (
    await page.request.post("/api/v1/projects", { data: { name } })
  ).json();
  const session = await (
    await page.request.post("/api/v1/sessions", {
      data: { title: name, project_id: project.id },
    })
  ).json();
  await page.goto("/");
  await expect(page.locator("#new-chat")).toContainText("Cuộc trò chuyện mới");
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.locator("#search-dialog")).toBeVisible();
  await page.locator("#session-search").fill(name);
  await page
    .locator("#search-results")
    .getByRole("button", { name: new RegExp(name) })
    .click();
  await expect(page).toHaveURL(new RegExp(session.id));
  await expect(page.locator("#workspace-name")).toHaveText(name);
  await page.locator("#chat-options summary").click();
  await page.locator("#rename-chat").click();
  await page.locator("#rename-title").fill("Kế hoạch nghiên cứu");
  await page.locator("#rename-save").click();
  await expect(page.locator("#chat-title")).toHaveText("Kế hoạch nghiên cứu");
  await page.reload();
  await expect(page.locator("#chat-title")).toHaveText("Kế hoạch nghiên cứu");
  await page.locator("#new-chat").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#workspace-name")).toHaveText("");
});

test("project lets users type immediately, shows attachments and isolates drafts", async ({
  page,
}) => {
  const name = `project-ux-${Date.now()}`;
  const project = await (
    await page.request.post("/api/v1/projects", { data: { name } })
  ).json();
  await page.goto(`/?project=${project.id}`);
  await expect(page.locator("#composer")).toBeVisible();
  await page.locator("#composer").fill("Bản nháp trong project");
  await page.locator("#attach-file").click();
  await page.locator("#file-input").setInputFiles({
    name: "brief.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(name),
  });
  await expect(page.locator("#attachment-list")).toContainText("brief.txt", {
    timeout: 15000,
  });
  await expect(page.locator("#composer")).toHaveValue("Bản nháp trong project");
  const sessionUrl = page.url();
  await page.locator("#new-chat").click();
  await expect(page.locator("#composer")).toHaveValue("");
  await page.locator("#composer").fill("Bản nháp độc lập");
  await page.locator("#new-chat").click();
  await expect(page.locator("#composer")).toHaveValue("");
  await page.goBack();
  await expect(page).toHaveURL(sessionUrl);
  await expect(page.locator("#composer")).toHaveValue("Bản nháp trong project");
  await expect(page.locator("#attachment-list")).toContainText("brief.txt");
  await page
    .locator("#attachment-list")
    .getByRole("button", { name: "Gỡ tài liệu brief.txt" })
    .click();
  await expect(page.locator("#attachment-list")).not.toContainText("brief.txt");
  await expect(page.locator("#chat-error")).toBeHidden();
});

test("chat and project composer remain usable at narrow and desktop widths", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const project = await (
    await page.request.post("/api/v1/projects", {
      data: { name: "Kế hoạch nghiên cứu tài liệu và tổng hợp kết quả" },
    })
  ).json();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/?project=${project.id}`);
    await expect(page.locator("#composer")).toBeInViewport();
    await expect(page.locator("#project-heading")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator("#project-files").click();
    await expect(page.locator("#documents-panel")).toBeVisible();
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => !!document.activeElement.closest("#documents-panel"),
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator("#project-files")).toBeFocused();
  }
  expect(errors).toEqual([]);
});

test("many attached files stay compact and can all be managed on mobile", async ({
  page,
}) => {
  const session = await (
    await page.request.post("/api/v1/sessions", {
      data: { title: "Tài liệu tham khảo" },
    })
  ).json();
  for (let i = 0; i < 5; i++) {
    const result = await page.request.post("/api/v1/documents", {
      multipart: {
        session_id: session.id,
        file: {
          name: `reference-${i}.txt`,
          mimeType: "text/plain",
          buffer: Buffer.from(`${session.id} file ${i}`),
        },
      },
    });
    expect(result.status()).toBe(202);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`/?session=${session.id}`);
  await expect(page.locator("#attachment-list")).toContainText(
    "3 tài liệu khác",
  );
  await expect(page.locator("#send")).toBeInViewport();
  expect(
    (await page.locator("#attachment-list").boundingBox()).height,
  ).toBeLessThan(220);
  await page.getByRole("button", { name: "+ 3 tài liệu khác" }).click();
  await expect(page.locator("#document-list .document-row")).toHaveCount(5);
});
