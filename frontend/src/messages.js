import { $, element, icon, showError } from "./dom.js";

export function messageView(docs, openDocuments, trace) {
  function decorateCitations(result) {
    const raw = result.rawText ?? result.content.textContent ?? "";
    const refs = result.refs || [];
    result.content.replaceChildren();
    if (!refs.length || !/\[\d+\]/.test(raw)) {
      result.content.textContent = raw;
      return;
    }
    const parts = raw.split(/(\[\d+\])/g);
    for (const part of parts) {
      const match = /^\[(\d+)\]$/.exec(part);
      if (match) {
        const idx = Number(match[1]) - 1;
        const ref = refs[idx];
        if (ref) {
          const chip = element("span", "citation-chip", part);
          chip.setAttribute("role", "button");
          chip.setAttribute("tabindex", "0");
          chip.title = `${ref.name} · Trang ${ref.page}`;
          const openRef = () => {
            trace?.setPanelTab("docs");
            docs.sources(refs, idx);
            openDocuments();
          };
          chip.addEventListener("click", openRef);
          chip.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openRef();
            }
          });
          result.content.append(chip);
          continue;
        }
      }
      if (part) result.content.append(document.createTextNode(part));
    }
  }

  function updateTrace(result, traceData, refs = result.refs || []) {
    if (!result.traceBar) return;
    result.traceData = traceData || result.traceData || {};
    result.refs = refs;
    const t = result.traceData;
    const matched = Number(t.selected_chunks ?? t.matched_chunks ?? refs.length);
    const scanned = Number(t.scanned_chunks ?? refs.length);
    const retrieveMs = Number(t.retrieve_ms ?? 0);
    const totalMs = Number(t.total_ms ?? retrieveMs);
    const ttftMs = Number(t.ttft_ms ?? 0);
    const ctxChars = Number(
      t.context_chars ??
        refs.reduce((acc, s) => acc + (s.text ? s.text.length + 24 : 0), 0),
    );

    result.traceBar.replaceChildren();
    result.traceBar.hidden = false;

    const statusPill = element(
      "span",
      `trace-pill ${matched > 0 ? "ok" : "warn"}`,
      matched > 0
        ? `✓ ${matched}${scanned > matched ? `/${scanned}` : ""} đoạn khớp`
        : "⚠ 0 đoạn khớp",
    );
    result.traceBar.append(statusPill);

    if (retrieveMs > 0) {
      result.traceBar.append(
        element("span", "trace-pill", `Truy xuất ${retrieveMs.toFixed(0)} ms`),
      );
    }
    if (ctxChars > 0) {
      result.traceBar.append(
        element(
          "span",
          "trace-pill",
          `${ctxChars.toLocaleString("vi-VN")} ký tự ngữ cảnh`,
        ),
      );
    }
    if (ttftMs > 0) {
      result.traceBar.append(
        element("span", "trace-pill", `TTFT ${ttftMs.toFixed(0)} ms`),
      );
    }
    if (totalMs > 0) {
      result.traceBar.append(
        element("span", "trace-pill", `Tổng ${totalMs.toFixed(0)} ms`),
      );
    }

    const openTraceBtn = element("button", "trace-open-btn", "Mở bảng Trace");
    openTraceBtn.type = "button";
    openTraceBtn.addEventListener("click", () => {
      trace?.inspectTurn(result.turnId);
    });
    result.traceBar.append(openTraceBtn);
  }

  function addSources(message, refs) {
    message.refs = refs || [];
    message.actions.querySelector(".source-link")?.remove();
    if (refs.length) {
      const button = element(
        "button",
        "source-link",
        `${refs.length} nguồn tham khảo`,
      );
      button.type = "button";
      button.addEventListener("click", () => {
        trace?.setPanelTab("docs");
        docs.sources(refs);
        openDocuments();
      });
      message.actions.append(button);
    }
    decorateCitations(message);
    if (message.role === "assistant") {
      updateTrace(message, message.traceData, refs);
    }
  }

  function add(message) {
    const row = element(
      "article",
      `message ${message.role} ${message.status || ""}`,
    );
    let traceBar = null;
    if (message.role === "assistant") {
      const header = element("div", "message-header");
      header.append(
        element("span", "mini-mark", "D"),
        element("span", "", "DocuminChat"),
      );
      row.append(header);
      traceBar = element("div", "trace-meta-line");
      traceBar.hidden = true;
      row.append(traceBar);
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
    const result = {
      row,
      content,
      actions,
      traceBar,
      role: message.role,
      rawText: message.content || "",
      refs: message.sources || [],
      traceData: message.trace || null,
      turnId: message.id || null,
    };
    addSources(result, message.sources || []);
    if (message.role === "assistant" && (message.trace || message.sources?.length)) {
      updateTrace(result, message.trace, message.sources || []);
    }
    return result;
  }

  return { add, addSources, updateTrace, decorateCitations };
}

