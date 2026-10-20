import { test, expect } from "@playwright/test";

test("project sources are shared while attached session files stay in that chat", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#connection")).toContainText("Chưa kết nối model");
  const name = `Research ${Date.now()}`;
  await page.getByRole("button", { name: "Tạo Project", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Tên Project", exact: true })
    .fill(name);
  await page.getByRole("button", { name: "Tạo", exact: true }).click();
  await expect(page.locator("#project-view")).toBeVisible();
  await expect(page.locator("#project-heading")).toHaveText(name);
  await expect(page.locator("#document-target")).toHaveValue("project");
  await page
    .getByRole("button", { name: "Thêm tệp vào Project", exact: true })
    .click();
  await page.locator("#file-input").setInputFiles({
    name: "project-guide.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(`Project guide ${name}`),
  });
  await expect(page.locator("#project-file-list")).toContainText(
    "project-guide.txt",
    { timeout: 15000 },
  );
  await expect(page.locator("#project-file-list")).toContainText("Sẵn sàng");
  await page.locator("#project-start-chat").click();
  await page
    .getByRole("button", { name: "Đính kèm tài liệu", exact: true })
    .click();
  await page.locator("#file-input").setInputFiles({
    name: "session-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(`Private notes ${name}`),
  });
  await page.locator("#open-documents").click();
  await expect(page.locator("#document-list")).toContainText(
    "session-notes.txt",
    { timeout: 15000 },
  );
  await expect(page.locator("#document-list")).toContainText(
    "project-guide.txt",
  );
  await page.reload();
  await expect(page).toHaveURL(/\?session=/);
  await page.locator("#open-documents").click();
  await expect(page.locator("#document-list")).toContainText(
    "session-notes.txt",
  );
  await expect(page.locator("#document-list")).toContainText(
    "project-guide.txt",
  );
  await page.getByRole("button", { name: "Đóng bảng tài liệu" }).click();
  await page.getByRole("button", { name: name, exact: true }).click();
  await expect(page.locator("#project-file-list")).toContainText(
    "project-guide.txt",
  );
  await expect(page.locator("#project-file-list")).not.toContainText(
    "session-notes.txt",
  );
  await page.screenshot({
    path: "../artifacts/project-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#project-view")).toBeVisible();
  await expect(page.locator("#project-heading")).toBeInViewport();
  await expect(page.locator("#sidebar")).not.toBeInViewport();
  await expect(page.locator("#documents-panel")).not.toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../artifacts/project-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("#project-start-chat").click();
  await page.locator("#open-documents").click();
  await expect(page.locator("#document-list")).toContainText(
    "project-guide.txt",
  );
  await expect(page.locator("#document-list")).not.toContainText(
    "session-notes.txt",
  );
  await page.screenshot({
    path: "../artifacts/project-session.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
