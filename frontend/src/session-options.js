import { errorText } from "./api.js";
import { $, showError } from "./dom.js";

export function sessionOptions(current, update) {
  const closeMenu = () => {
    $("chat-options").open = false;
  };
  $("rename-chat").addEventListener("click", () => {
    if (!current()) return;
    closeMenu();
    $("rename-title").value = current().title;
    showError("rename-error");
    $("rename-dialog").showModal();
    $("rename-title").focus();
    $("rename-title").select();
  });
  $("move-chat").addEventListener("click", () => {
    if (!current()) return;
    closeMenu();
    $("session-project").value = current().project_id || "";
    showError("move-error");
    $("move-dialog").showModal();
  });
  for (const [form, button, dialog, error, changes] of [
    [
      "rename-form",
      "rename-save",
      "rename-dialog",
      "rename-error",
      () => ({ title: $("rename-title").value.trim() }),
    ],
    [
      "move-form",
      "move-save",
      "move-dialog",
      "move-error",
      () => ({ project_id: $("session-project").value || null }),
    ],
  ])
    $(form).addEventListener("submit", async (event) => {
      event.preventDefault();
      $(button).disabled = true;
      try {
        await update(changes());
        $(dialog).close();
      } catch (e) {
        showError(error, errorText(e));
      } finally {
        $(button).disabled = false;
      }
    });
  document
    .querySelectorAll("[data-dialog-close]")
    .forEach((button) =>
      button.addEventListener("click", () => button.closest("dialog").close()),
    );
  $("pin-chat").addEventListener("click", () => {
    const s = current();
    if (s)
      update({ pinned: !s.pinned }).catch((e) =>
        showError("chat-error", errorText(e)),
      );
    closeMenu();
  });
  $("archive-current").addEventListener("click", () => {
    const s = current();
    if (s)
      update({ archived: !s.archived }).catch((e) =>
        showError("chat-error", errorText(e)),
      );
    closeMenu();
  });
  document.addEventListener("click", (event) => {
    if (!$("chat-options").contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}
