import { json } from "./api.js";
import { $ } from "./dom.js";
import { documents } from "./documents.js";
import { chat } from "./chat.js";

let opener;
function closeDrawers() {
  $("sidebar").classList.remove("open");
  $("scrim").hidden = true;
  $("sidebar").inert = innerWidth <= 700;
  $("main").inert = false;
  $("open-sidebar").setAttribute(
    "aria-expanded",
    String(
      innerWidth > 700 && document.body.dataset.sidebarCollapsed !== "true",
    ),
  );
  if ($("documents-panel").open) $("documents-panel").close();
  opener?.focus();
  opener = null;
}
function sidebar() {
  if (innerWidth > 700) {
    const collapsed = document.body.dataset.sidebarCollapsed !== "true";
    document.body.dataset.sidebarCollapsed = String(collapsed);
    $("sidebar").inert = collapsed;
    $("open-sidebar").setAttribute("aria-expanded", String(!collapsed));
    return;
  }
  if ($("sidebar").classList.contains("open")) {
    closeDrawers();
    return;
  }
  opener = $("open-sidebar");
  $("sidebar").inert = false;
  $("sidebar").classList.add("open");
  $("scrim").hidden = false;
  $("main").inert = true;
  $("open-sidebar").setAttribute("aria-expanded", "true");
  $("sidebar").querySelector("button").focus();
}
function openDocuments() {
  if ($("panel-docs-body") && $("panel-trace-body")) {
    $("panel-docs-body").hidden = false;
    if ($("panel-params-body")) $("panel-params-body").hidden = true;
    $("panel-trace-body").hidden = true;
    $("panel-tab-docs")?.classList.add("active");
    $("panel-tab-docs")?.setAttribute("aria-selected", "true");
    $("panel-tab-params")?.classList.remove("active");
    $("panel-tab-params")?.setAttribute("aria-selected", "false");
    $("panel-tab-trace")?.classList.remove("active");
    $("panel-tab-trace")?.setAttribute("aria-selected", "false");
  }
  if (!$("documents-panel").open) {
    $("documents-panel").showModal();
    $("documents-panel").classList.add("open");
    $("open-documents").setAttribute("aria-expanded", "true");
  }
}
$("documents-panel").addEventListener("close", () => {
  $("documents-panel").classList.remove("open");
  $("open-documents").setAttribute("aria-expanded", "false");
  document
    .querySelectorAll("[data-rail]")
    .forEach((btn) => btn.setAttribute("aria-pressed", "false"));
});
$("open-documents").addEventListener("click", openDocuments);
$("project-files").addEventListener("click", openDocuments);
$("open-sidebar").addEventListener("click", sidebar);
$("scrim").addEventListener("click", closeDrawers);
document
  .querySelectorAll("[data-close]")
  .forEach((button) => button.addEventListener("click", closeDrawers));
document
  .querySelector("[data-close-documents]")
  .addEventListener("click", () => $("documents-panel").close());
$("documents-panel").addEventListener("click", (event) => {
  if (event.target !== $("documents-panel")) return;
  const r = event.target.getBoundingClientRect();
  if (
    event.clientX < r.left ||
    event.clientX > r.right ||
    event.clientY < r.top ||
    event.clientY > r.bottom
  )
    event.target.close();
});
document.addEventListener("keydown", (event) => {
  if (!$("sidebar").classList.contains("open")) return;
  if (event.key === "Escape") {
    closeDrawers();
    return;
  }
  if (event.key === "Tab") {
    const nodes = [
      ...$("sidebar").querySelectorAll("button:not(:disabled), a"),
    ].filter((node) => node.getClientRects().length);
    if (event.shiftKey && document.activeElement === nodes[0]) {
      event.preventDefault();
      nodes.at(-1)?.focus();
    } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
      event.preventDefault();
      nodes[0]?.focus();
    }
  }
});
window.addEventListener("resize", () => {
  closeDrawers();
  $("sidebar").inert =
    innerWidth <= 700 || document.body.dataset.sidebarCollapsed === "true";
});
$("sidebar").inert = innerWidth <= 700;
try {
  document.documentElement.dataset.theme =
    localStorage.getItem("documinchat-theme") || "dark";
} catch {}
$("theme-toggle").addEventListener("click", () => {
  const theme =
    document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("documinchat-theme", theme);
  } catch {}
});
const docs = documents(openDocuments),
  chats = chat(docs, closeDrawers, openDocuments);
$("attach-file").addEventListener("click", () => docs.attach());
$("project-add-file").addEventListener("click", () => docs.addProjectFile());
$("composer-documents").addEventListener("click", openDocuments);
$("model-info").addEventListener("click", () => $("model-dialog").showModal());
async function connect() {
  $("connection").className = "connection";
  $("connection").textContent = "Đang kết nối…";
  $("retry-connection").hidden = true;
  try {
    const health = await json("/health");
    $("model-name").textContent = health.model_name || "Chưa có model";
    $("model-description").textContent =
      health.model_name ||
      "Chưa có model kết nối. Thiết lập LLM_BASE_URL và LLM_MODEL trong cấu hình backend để gửi câu hỏi.";
    await chats.refresh();
    chats.connected(health.model_configured);
    $("connection").classList.add(health.model_configured ? "ok" : "warning");
    $("connection").textContent = health.model_configured
      ? "Sẵn sàng trò chuyện"
      : "Chưa kết nối model · Bạn vẫn có thể lưu và quản lý tài liệu";
  } catch {
    $("connection").classList.add("error");
    $("connection").textContent =
      "Không kết nối được dịch vụ. Thử kết nối lại.";
    $("retry-connection").hidden = false;
    chats.connected(false);
  }
}
$("retry-connection").addEventListener("click", connect);
connect();
