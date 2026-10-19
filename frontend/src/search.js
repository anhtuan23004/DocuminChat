import { json, errorText } from "./api.js";
import { $, element, icon, showError } from "./dom.js";

export function historySearch(onSelect, projectName) {
  let timer,
    controller,
    epoch = 0,
    offset = 0,
    query = "";
  function cancel() {
    ++epoch;
    clearTimeout(timer);
    controller?.abort();
  }
  function hint(message) {
    $("search-results").replaceChildren(element("p", "history-empty", message));
  }
  async function load(append = false) {
    controller?.abort();
    controller = new AbortController();
    const version = ++epoch;
    if (!append) {
      offset = 0;
      query = $("session-search").value.trim();
    }
    $("more-search").hidden = true;
    if (!query) {
      hint("Nhập một từ hoặc cụm từ bạn nhớ trong cuộc trò chuyện.");
      return;
    }
    if (!append) hint("Đang tìm trong lịch sử…");
    $("search-results").setAttribute("aria-busy", "true");
    showError("search-error");
    try {
      const data = await json(
        `/sessions?q=${encodeURIComponent(query)}&include_archived=true&offset=${offset}&limit=50`,
        { signal: controller.signal },
      );
      if (version !== epoch) return;
      if (!append) $("search-results").replaceChildren();
      for (const chat of data.items) {
        const button = element("button", "search-result");
        const text = element("span");
        text.append(
          element("strong", "", chat.title),
          element(
            "small",
            "",
            `${chat.project_id ? projectName(chat.project_id) || "Trong Project" : "Hội thoại riêng"}${chat.archived ? " · Đã lưu trữ" : ""}`,
          ),
        );
        button.append(icon("chat"), text);
        button.addEventListener("click", () => {
          $("search-dialog").close();
          onSelect(chat.id).catch((error) =>
            showError("chat-error", errorText(error)),
          );
        });
        $("search-results").append(button);
      }
      offset += data.items.length;
      if (!offset) hint("Không tìm thấy hội thoại. Thử từ khóa khác.");
      $("more-search").hidden = data.items.length < 50;
    } catch (error) {
      if (version === epoch && error.name !== "AbortError")
        showError("search-error", errorText(error));
    } finally {
      if (version === epoch)
        $("search-results").setAttribute("aria-busy", "false");
    }
  }
  function open() {
    $("session-search").value = "";
    showError("search-error");
    hint("Tìm lại một cuộc trò chuyện bằng tên hoặc nội dung.");
    $("more-search").hidden = true;
    $("search-dialog").showModal();
    $("session-search").focus();
  }
  $("search-chats").addEventListener("click", open);
  $("search-close").addEventListener("click", () => $("search-dialog").close());
  $("search-dialog").addEventListener("close", cancel);
  $("session-search").addEventListener("input", () => {
    cancel();
    timer = setTimeout(() => load(), 200);
  });
  $("more-search").addEventListener("click", () => load(true));
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (!$("search-dialog").open) open();
    }
  });
}
