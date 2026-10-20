import { json, request, errorText } from "./api.js";
import { readEvents } from "./stream.js";
import { ViewState } from "./state.js";
import { Drafts } from "./drafts.js";
import { historyPanel } from "./history.js";
import { projectPanel } from "./projects.js";
import { historySearch } from "./search.js";
import { messageView } from "./messages.js";
import { sessionOptions } from "./session-options.js";
import { $, element, icon, showError } from "./dom.js";

export function chat(docs, closeDrawers, openDocuments) {
  const state = new ViewState(),
    drafts = new Drafts();
  let activeProject = null,
    mode = "chat",
    pendingCreation = null,
    canSend = false,
    loading = false,
    follow = true,
    projectChats = [],
    projectOffset = 0;
  const projects = projectPanel(chooseProject),
    history = historyPanel(select),
    messages = messageView(docs, openDocuments);
  const draftKey = () => drafts.key(state.sessionId, activeProject?.id);
  const saveDraft = () => drafts.set(draftKey(), $("composer").value);
  const scopeValue = () => ({
    projectId: activeProject?.id || null,
    projectName: activeProject?.name || "",
    sessionId: state.sessionId,
    mode,
  });
  function resizeComposer() {
    $("composer").style.height = "auto";
    $("composer").style.height =
      `${Math.min(180, $("composer").scrollHeight)}px`;
  }
  function controls() {
    const busy = !!state.controller,
      archived = !!history.get(state.sessionId)?.archived;
    $("send").hidden = busy;
    $("stop").hidden = !busy;
    $("send").disabled =
      !canSend || archived || loading || !$("composer").value.trim();
    $("composer").disabled = busy || loading || archived;
    $("attach-file").disabled = busy || loading || archived;
    $("composer").placeholder = archived
      ? "Khôi phục hội thoại để tiếp tục…"
      : activeProject
        ? `Hỏi trong ${activeProject.name}…`
        : "Hỏi bất cứ điều gì, hoặc đính kèm tài liệu…";
  }
  function updateUrl() {
    const url = state.sessionId
      ? `/?session=${state.sessionId}`
      : activeProject
        ? `/?project=${activeProject.id}`
        : "/";
    if (location.pathname + location.search !== url)
      window.history.pushState(null, "", url);
  }
  function view() {
    const hasMessages = !!$("messages").childElementCount;
    projects.select(activeProject?.id || null);
    $("project-view").hidden = mode !== "project";
    $("welcome").hidden = mode === "project" || hasMessages || loading;
    $("chat-loading").hidden = !loading;
    $("workspace-name").textContent = activeProject?.name || "";
    $("back-to-project").hidden = !activeProject;
    $("breadcrumb-divider").hidden = !activeProject || mode === "project";
    $("project-heading").textContent = activeProject?.name || "";
    $("chat-title").textContent =
      mode === "project"
        ? ""
        : history.get(state.sessionId)?.title || "DocuminChat";
    $("chat-options").hidden = !state.sessionId || loading;
    $("archive-current").querySelector("span").textContent = history.get(
      state.sessionId,
    )?.archived
      ? "Khôi phục hội thoại"
      : "Lưu trữ hội thoại";
    const slot =
      mode === "project"
        ? $("project-composer-slot")
        : hasMessages || loading
          ? $("composer-dock")
          : $("welcome-composer-slot");
    if ($("composer-area").parentElement !== slot)
      slot.append($("composer-area"));
    updateUrl();
    controls();
    resizeComposer();
  }
  function restoreDraft() {
    $("composer").value = drafts.get(draftKey());
    resizeComposer();
    controls();
  }
  function projectChatRows() {
    $("project-chat-list").replaceChildren();
    if (!projectChats.length)
      $("project-chat-list").append(
        element(
          "p",
          "project-empty",
          "Chưa có hội thoại. Nhập câu hỏi ở trên để bắt đầu.",
        ),
      );
    for (const session of projectChats) {
      const button = element("button", "project-chat-row");
      button.append(
        icon("chat"),
        element("span", "", session.title),
        element(
          "time",
          "",
          new Date(session.updated_at || session.created_at).toLocaleDateString(
            "vi",
            { day: "numeric", month: "short" },
          ),
        ),
      );
      button.addEventListener("click", () =>
        select(session.id).catch((error) =>
          showError("chat-error", errorText(error)),
        ),
      );
      $("project-chat-list").append(button);
    }
  }
  async function loadProjectChats(append = false) {
    if (!activeProject || mode !== "project") return;
    const epoch = state.epoch,
      pid = activeProject.id;
    const data = await json(
      `/sessions?project_id=${pid}&offset=${append ? projectOffset : 0}&limit=50`,
    );
    if (!state.current(epoch) || mode !== "project") return;
    projectChats = append ? [...projectChats, ...data.items] : data.items;
    projectOffset = append
      ? projectOffset + data.items.length
      : data.items.length;
    $("more-project-chats").hidden = data.items.length < 50;
    projectChatRows();
  }
  async function chooseProject(project, clearDraft = false) {
    saveDraft();
    state.select(null);
    activeProject = project;
    mode = project ? "project" : "chat";
    loading = false;
    pendingCreation = null;
    follow = true;
    closeDrawers();
    history.select(null);
    $("messages").replaceChildren();
    showError("chat-error");
    projectChats = [];
    projectChatRows();
    view();
    if (clearDraft) drafts.set(draftKey(), "");
    restoreDraft();
    await Promise.all([
      history.refresh(),
      docs.setScope(scopeValue()),
      loadProjectChats(),
    ]);
  }
  async function select(id) {
    if (!id) {
      await chooseProject(activeProject);
      $("composer").focus();
      return;
    }
    saveDraft();
    const epoch = state.select(id);
    loading = true;
    mode = "chat";
    pendingCreation = null;
    closeDrawers();
    $("messages").replaceChildren();
    $("chat-loading").hidden = false;
    $("welcome").hidden = true;
    $("project-view").hidden = true;
    $("chat-options").hidden = true;
    showError("chat-error");
    controls();
    try {
      const session = history.get(id) || (await json(`/sessions/${id}`));
      const project = await projects.resolve(session.project_id);
      if (!state.current(epoch)) return;
      activeProject = project;
      history.add(session);
      view();
      restoreDraft();
      await docs.setScope(scopeValue());
      let offset = 0;
      while (state.current(epoch)) {
        const data = await json(
          `/sessions/${id}/messages?offset=${offset}&limit=200`,
        );
        if (!state.current(epoch)) return;
        data.items.forEach(messages.add);
        offset += data.items.length;
        const latest = [...data.items].reverse().find((m) => m.sources?.length);
        if (latest) docs.sources(latest.sources);
        if (data.items.length < 200) break;
      }
      if (state.current(epoch)) {
        loading = false;
        follow = true;
        view();
        scroll(true);
      }
    } catch (error) {
      if (state.current(epoch)) {
        loading = false;
        view();
        showError("chat-error", errorText(error));
      }
    }
  }
  async function ensureSession() {
    if (state.sessionId) return state.sessionId;
    const epoch = state.epoch;
    if (pendingCreation?.epoch === epoch) return pendingCreation.promise;
    saveDraft();
    const previousDraft = draftKey();
    const promise = (async () => {
      const session = await json("/sessions", {
        method: "POST",
        body: JSON.stringify({ project_id: activeProject?.id || null }),
      });
      if (!state.current(epoch))
        throw new DOMException("Context đã thay đổi", "AbortError");
      state.sessionId = session.id;
      mode = "chat";
      drafts.move(previousDraft, draftKey());
      history.add(session);
      view();
      restoreDraft();
      await docs.setScope(scopeValue());
      if (!state.current(epoch))
        throw new DOMException("Context đã thay đổi", "AbortError");
      return session.id;
    })();
    pendingCreation = { epoch, promise };
    try {
      return await promise;
    } finally {
      if (pendingCreation?.epoch === epoch) pendingCreation = null;
    }
  }
  async function bootstrap() {
    const epoch = state.epoch;
    await projects.refresh();
    if (!state.current(epoch)) return;
    const query = new URLSearchParams(location.search);
    try {
      if (query.get("session")) await select(query.get("session"));
      else if (query.get("project"))
        await chooseProject(await projects.resolve(query.get("project")));
      else await chooseProject(null);
    } catch (error) {
      await chooseProject(null);
      showError("chat-error", errorText(error));
    }
    await history.refresh();
  }
  async function updateSession(changes) {
    const id = state.sessionId,
      epoch = state.epoch;
    if (!id) return;
    const session = await history.update(id, changes);
    if (!state.current(epoch)) return;
    history.add(session);
    if ("project_id" in changes) await select(id);
    else view();
  }
  function scroll(force = false) {
    if (force || follow)
      $("conversation").scrollTop = $("conversation").scrollHeight;
  }
  $("conversation").addEventListener("scroll", () => {
    const el = $("conversation");
    follow = el.scrollHeight - el.clientHeight - el.scrollTop < 100;
    $("jump-to-bottom").hidden = follow;
  });
  $("jump-to-bottom").addEventListener("click", () => {
    follow = true;
    scroll(true);
  });
  async function send(event) {
    event.preventDefault();
    const query = $("composer").value.trim();
    if (
      !query ||
      state.controller ||
      loading ||
      !canSend ||
      history.get(state.sessionId)?.archived
    )
      return;
    const controller = new AbortController(),
      epoch = state.epoch;
    state.controller = controller;
    controls();
    showError("chat-error");
    let assistant;
    try {
      const id = await ensureSession();
      if (!state.current(epoch)) return;
      const response = await request(`/sessions/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: query,
          document_ids: [...docs.selected],
          request_id: crypto.randomUUID(),
        }),
        signal: controller.signal,
      });
      if (!state.current(epoch)) return;
      $("composer").value = "";
      drafts.set(draftKey(), "");
      messages.add({ role: "user", content: query });
      assistant = messages.add({
        role: "assistant",
        content: "",
        status: "streaming",
      });
      view();
      follow = true;
      scroll(true);
      await readEvents(
        response,
        (event) => {
          if (!state.current(epoch)) return;
          if (event.type === "delta") {
            assistant.content.textContent += event.data.text;
            scroll();
          }
          if (event.type === "sources") {
            docs.sources(event.data.items);
            messages.addSources(assistant, event.data.items);
          }
        },
        controller.signal,
      );
      if (state.current(epoch)) {
        assistant.row.classList.remove("streaming");
        assistant.row.querySelector(".message-status")?.remove();
        await history.refresh();
        if (state.current(epoch)) view();
      }
    } catch (error) {
      if (state.current(epoch)) {
        showError(
          "chat-error",
          error.name === "AbortError"
            ? "Đã dừng nhận trả lời. Lượt này có thể chưa hoàn tất trên model."
            : errorText(error),
        );
        if (assistant) {
          assistant.row.classList.remove("streaming");
          assistant.row.classList.add("failed");
          const status = assistant.row.querySelector(".message-status");
          if (status) status.textContent = "Lượt trả lời bị gián đoạn";
        }
      }
    } finally {
      if (state.current(epoch)) {
        state.controller = null;
        controls();
        $("composer").focus();
      }
    }
  }
  docs.bindSessionCreator(ensureSession);
  historySearch(select, (id) => projects.get(id)?.name);
  sessionOptions(() => history.get(state.sessionId), updateSession);
  $("chat-form").addEventListener("submit", send);
  $("composer").addEventListener("input", () => {
    saveDraft();
    resizeComposer();
    controls();
  });
  $("composer").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      $("chat-form").requestSubmit();
    }
  });
  $("stop").addEventListener("click", () => state.controller?.abort());
  $("new-chat").addEventListener("click", () =>
    chooseProject(null, true)
      .then(() => $("composer").focus())
      .catch((error) => showError("chat-error", errorText(error))),
  );
  $("back-to-project").addEventListener("click", () =>
    chooseProject(activeProject).catch((error) =>
      showError("chat-error", errorText(error)),
    ),
  );
  $("home").addEventListener("click", () =>
    chooseProject(null).catch((error) =>
      showError("chat-error", errorText(error)),
    ),
  );
  $("project-start-chat").addEventListener("click", () => {
    $("composer").focus();
  });
  $("more-project-chats").addEventListener("click", () =>
    loadProjectChats(true).catch((error) =>
      showError("chat-error", errorText(error)),
    ),
  );
  window.addEventListener("popstate", () => {
    const query = new URLSearchParams(location.search);
    (query.get("session")
      ? select(query.get("session"))
      : projects.resolve(query.get("project")).then(chooseProject)
    ).catch((error) => showError("chat-error", errorText(error)));
  });
  document.querySelectorAll("[data-prompt]").forEach((button) =>
    button.addEventListener("click", () => {
      $("composer").value = button.dataset.prompt;
      saveDraft();
      controls();
      resizeComposer();
      $("composer").focus();
    }),
  );
  controls();
  return {
    refresh: bootstrap,
    connected(value) {
      canSend = value;
      controls();
    },
  };
}
