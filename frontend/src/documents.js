import { json, errorText } from "./api.js";
import { $, element, icon, showError } from "./dom.js";
import { DocumentScope } from "./scope.js";
import { sourcePanel } from "./sources.js";

export function documents(openDocuments) {
  const scope = new DocumentScope(),
    selected = new Set(),
    seenReady = new Set();
  const sources = sourcePanel();
  let items = [],
    timer,
    controller,
    ensureSession;
  const statuses = {
    pending: "Đang chờ xử lý",
    processing: "Đang đọc tài liệu…",
    ready: "Sẵn sàng",
    failed: "Xử lý thất bại",
  };
  function context() {
    const { projectId, projectName, sessionId, mode } = scope.value;
    $("doc-count").textContent = items.length;
    $("project-file-count").textContent = items.length;
    $("context-label").textContent = selected.size
      ? `${selected.size} tài liệu đang dùng${projectName ? ` · ${projectName}` : " · Riêng hội thoại này"}`
      : projectId
        ? `Nguồn chung của ${projectName}`
        : "";
    $("context-label").classList.toggle("has-context", !!selected.size);
    $("document-scope-title").textContent = sessionId
      ? "Tài liệu hội thoại"
      : projectId
        ? "Tài liệu Project"
        : "Tài liệu hội thoại";
    $("document-scope-description").textContent = sessionId
      ? "File riêng của hội thoại và các nguồn được kế thừa từ Project."
      : projectId
        ? `File trong ${projectName} được dùng chung cho các hội thoại của Project.`
        : "Đính kèm file sẽ tạo và lưu một hội thoại riêng.";
    const target = $("document-target").value;
    $("document-target").replaceChildren();
    if (projectId) {
      const p = element("option", "", `Project: ${projectName}`);
      p.value = "project";
      $("document-target").append(p);
    }
    const s = element("option", "", "Chỉ hội thoại này");
    s.value = "session";
    $("document-target").append(s);
    $("document-target").value =
      target === "project" && projectId ? "project" : "session";
  }
  async function detach(binding) {
    if (
      binding.project_id &&
      !confirm(
        "Gỡ file khỏi Project? Các hội thoại trong Project sẽ không còn dùng file này làm ngữ cảnh.",
      )
    )
      return;
    try {
      await json(`/document-bindings/${binding.id}`, { method: "DELETE" });
      await refresh();
    } catch (error) {
      showError("document-error", errorText(error));
    }
  }
  function row(doc, compact = false, attachment = false) {
    const local = doc.bindings?.find(
      (b) => b.session_id && b.session_id === scope.value.sessionId,
    );
    const binding =
      local ||
      doc.bindings?.find(
        (b) => b.project_id && b.project_id === scope.value.projectId,
      );
    const container = element(
      "div",
      attachment
        ? "attachment-chip"
        : compact
          ? "project-file-row"
          : "document-row",
    );
    if (!compact && !attachment) {
      const checkbox = element("input");
      checkbox.type = "checkbox";
      checkbox.checked = selected.has(doc.id);
      checkbox.disabled = doc.status !== "ready";
      checkbox.setAttribute("aria-label", `Chọn tài liệu ${doc.name}`);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked && selected.size >= 20) {
          checkbox.checked = false;
          showError(
            "document-error",
            "Chọn tối đa 20 tài liệu cho một lượt hỏi.",
          );
          return;
        }
        checkbox.checked ? selected.add(doc.id) : selected.delete(doc.id);
        contextLabel();
      });
      container.append(checkbox);
    } else container.append(icon("doc"));
    const info = element("div", "document-info");
    info.append(
      element("span", "document-name", doc.name),
      element(
        "div",
        `document-meta ${doc.status}`,
        `${statuses[doc.status]} · ${local ? "Hội thoại" : "Project"}`,
      ),
    );
    if (doc.error) info.append(element("p", "document-error", doc.error));
    container.append(info);
    if (binding && (local || scope.value.mode === "project")) {
      const remove = element("button", "icon-button");
      remove.type = "button";
      remove.append(icon("close"));
      remove.setAttribute("aria-label", `Gỡ tài liệu ${doc.name}`);
      remove.addEventListener("click", () => detach(binding));
      container.append(remove);
    }
    return container;
  }
  function contextLabel() {
    $("context-label").textContent = selected.size
      ? `${selected.size} tài liệu · ${scope.value.projectName || "Hội thoại này"}`
      : "Không chọn tài liệu · Trò chuyện với model";
  }
  function render() {
    const allowed = new Set(
      items.filter((d) => d.status === "ready").map((d) => d.id),
    );
    for (const id of selected) if (!allowed.has(id)) selected.delete(id);
    for (const doc of items)
      if (doc.status === "ready" && !seenReady.has(doc.id)) {
        seenReady.add(doc.id);
        if (selected.size < 20) selected.add(doc.id);
      }
    $("document-list").replaceChildren();
    $("project-file-list").replaceChildren();
    $("attachment-list").replaceChildren();
    const attachments = items.filter((d) =>
      d.bindings?.some(
        (b) => b.session_id && b.session_id === scope.value.sessionId,
      ),
    );
    attachments
      .slice(0, 2)
      .forEach((d) => $("attachment-list").append(row(d, false, true)));
    if (attachments.length > 2) {
      const more = element(
        "button",
        "text-button",
        `+ ${attachments.length - 2} tài liệu khác`,
      );
      more.type = "button";
      more.addEventListener("click", openDocuments);
      $("attachment-list").append(more);
    }
    if (!items.length) {
      $("document-list").append(
        element("div", "empty-docs", "Chưa có tài liệu tại đây."),
      );
      $("project-file-list").append(
        element(
          "p",
          "project-empty",
          "Thêm file để mọi hội thoại trong Project có chung nguồn tham khảo.",
        ),
      );
    }
    for (const label of ["Project", "Hội thoại"]) {
      const docs = items.filter(
        (d) =>
          label ===
          (d.bindings?.some(
            (b) => b.session_id && b.session_id === scope.value.sessionId,
          )
            ? "Hội thoại"
            : "Project"),
      );
      if (!docs.length) continue;
      $("document-list").append(
        element(
          "div",
          "file-group",
          label === "Project" ? "TỪ PROJECT" : "CHỈ HỘI THOẠI NÀY",
        ),
      );
      docs.forEach((d) => $("document-list").append(row(d)));
    }
    if (scope.value.mode === "project")
      items.forEach((d) => $("project-file-list").append(row(d, true)));
    context();
  }
  async function refresh(polls = 0) {
    clearTimeout(timer);
    controller?.abort();
    controller = new AbortController();
    const request = controller;
    const epoch = scope.epoch,
      query = scope.query();
    if (!query) {
      items = [];
      render();
      return;
    }
    try {
      const data = await json(`/documents?${query}`, {
        signal: request.signal,
      });
      if (!scope.current(epoch) || request !== controller) return;
      items = data.items;
      render();
      showError("document-error");
      if (items.some((d) => ["pending", "processing"].includes(d.status))) {
        if (polls < 120) timer = setTimeout(() => refresh(polls + 1), 3000);
        else
          showError(
            "document-error",
            "Tài liệu vẫn đang xử lý. Bấm Làm mới để kiểm tra lại.",
          );
      }
    } catch (error) {
      if (error.name !== "AbortError" && scope.current(epoch))
        showError("document-error", errorText(error));
    }
  }
  async function setScope(value) {
    scope.set(value);
    selected.clear();
    seenReady.clear();
    items = [];
    sources([]);
    showError("document-error");
    render();
    $("document-target").value =
      value.mode === "project" ? "project" : "session";
    return refresh();
  }
  $("refresh-documents").addEventListener("click", () => refresh());
  $("file-input").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      showError("document-error", "File vượt giới hạn 20 MB.");
      event.target.value = "";
      return;
    }
    $("upload-zone").classList.add("busy");
    event.target.disabled = true;
    let epoch = scope.epoch;
    try {
      const target = $("document-target").value;
      let value = { ...scope.value };
      if (target === "session" && !value.sessionId) {
        await ensureSession();
        value = { ...scope.value };
        epoch = scope.epoch;
      }
      const body = new FormData();
      body.append("file", file);
      body.append(
        target === "project" ? "project_id" : "session_id",
        target === "project" ? value.projectId : value.sessionId,
      );
      await json("/documents", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(120000),
      });
      if (scope.current(epoch)) await refresh();
    } catch (error) {
      if (scope.current(epoch) && error.name !== "AbortError")
        showError("document-error", errorText(error));
    } finally {
      $("upload-zone").classList.remove("busy");
      event.target.disabled = false;
      event.target.value = "";
    }
  });
  render();
  return {
    refresh,
    setScope,
    sources,
    selected,
    bindSessionCreator(callback) {
      ensureSession = callback;
    },
    attach() {
      $("document-target").value = "session";
      $("file-input").click();
    },
    addProjectFile() {
      $("document-target").value = "project";
      $("file-input").click();
    },
  };
}
