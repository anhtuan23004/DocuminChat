import { $, element, icon, showError } from "./dom.js";

export function messageView(docs, openDocuments) {
  function addSources(message, refs) {
    message.actions.querySelector(".source-link")?.remove();
    if (!refs.length) return;
    const button = element(
      "button",
      "source-link",
      `${refs.length} nguồn tham khảo`,
    );
    button.addEventListener("click", () => {
      docs.sources(refs);
      openDocuments();
    });
    message.actions.append(button);
  }
  function add(message) {
    const row = element(
      "article",
      `message ${message.role} ${message.status || ""}`,
    );
    if (message.role === "assistant") {
      const header = element("div", "message-header");
      header.append(
        element("span", "mini-mark", "D"),
        element("span", "", "DocuminChat"),
      );
      row.append(header);
    }
    const content = element("div", "message-content", message.content || "");
    row.append(content);
    if (["failed", "streaming"].includes(message.status))
      row.append(
        element(
          "span",
          "message-status",
          message.status === "failed"
            ? "Lượt trả lời bị gián đoạn"
            : "Đang trả lời…",
        ),
      );
    const actions = element("div", "message-actions");
    const copy = element("button", "icon-button");
    copy.type = "button";
    copy.setAttribute("aria-label", "Sao chép tin nhắn");
    copy.title = "Sao chép";
    copy.append(icon("copy"));
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(content.textContent);
        copy.title = "Đã sao chép";
      } catch {
        showError(
          "chat-error",
          "Không sao chép được. Bạn có thể chọn nội dung để sao chép.",
        );
      }
    });
    actions.append(copy);
    row.append(actions);
    $("messages").append(row);
    const result = { row, content, actions };
    addSources(result, message.sources || []);
    return result;
  }
  return { add, addSources };
}
