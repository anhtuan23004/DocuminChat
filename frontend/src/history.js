import { json, errorText } from "./api.js";
import { $, element, icon, showError } from "./dom.js";

export function historyPanel(onSelect) {
  let items = [],
    selectedId = null,
    current = null,
    archived = false,
    more = false,
    epoch = 0,
    offset = 0;
  function group(session) {
    if (session.pinned) return "ĐÃ GHIM";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(
      session.updated_at || session.created_at || Date.now(),
    );
    day.setHours(0, 0, 0, 0);
    const age = Math.round((today - day) / 86400000);
    return age < 1
      ? "HÔM NAY"
      : age < 2
        ? "HÔM QUA"
        : age < 7
          ? "TUẦN NÀY"
          : "TRƯỚC ĐÓ";
  }
  function render() {
    $("session-list").replaceChildren();
    const groups = new Map(
      ["ĐÃ GHIM", "HÔM NAY", "HÔM QUA", "TUẦN NÀY", "TRƯỚC ĐÓ"].map((name) => [
        name,
        [],
      ]),
    );
    items.forEach((s) => groups.get(group(s)).push(s));
    for (const [name, rows] of groups) {
      if (!rows.length) continue;
      $("session-list").append(element("div", "history-group", name));
      for (const session of rows) {
        const row = element(
          "div",
          `session-item${selectedId === session.id ? " active" : ""}`,
        );
        const button = element("button", "session-row");
        button.append(element("span", "session-title", session.title));
        button.title = session.title;
        if (selectedId === session.id)
          button.setAttribute("aria-current", "page");
        button.addEventListener("click", () =>
          onSelect(session.id).catch((error) =>
            showError("chat-error", errorText(error)),
          ),
        );
        const actions = element("div", "session-actions");
        for (const [label, name, changes] of [
          [
            session.pinned ? "Bỏ ghim" : "Ghim",
            "bookmark",
            { pinned: !session.pinned },
          ],
          [
            session.archived ? "Khôi phục" : "Lưu trữ",
            session.archived ? "undo" : "archive",
            { archived: !session.archived },
          ],
        ]) {
          const action = element("button", "icon-button");
          action.type = "button";
          action.setAttribute(
            "aria-label",
            `${label} hội thoại ${session.title}`,
          );
          action.title = label;
          action.append(icon(name));
          action.addEventListener("click", () =>
            update(session.id, changes).catch((error) =>
              showError("chat-error", errorText(error)),
            ),
          );
          actions.append(action);
        }
        row.append(button, actions);
        $("session-list").append(row);
      }
    }
    if (!items.length)
      $("session-list").append(
        element(
          "p",
          "history-empty",
          archived
            ? "Chưa có hội thoại lưu trữ."
            : "Các cuộc trò chuyện của bạn sẽ xuất hiện ở đây.",
        ),
      );
    $("more-sessions").hidden = !more;
    for (const [id, value] of [
      ["history-active", false],
      ["history-archived", true],
    ]) {
      $(id).classList.toggle("active", archived === value);
      $(id).setAttribute("aria-pressed", String(archived === value));
    }
    const s = get(selectedId);
    $("pin-chat").disabled = !s;
    $("pin-chat").setAttribute("aria-pressed", String(!!s?.pinned));
    $("pin-chat").querySelector("span").textContent = s?.pinned
      ? "Bỏ ghim hội thoại"
      : "Ghim hội thoại";
  }
  function get(id) {
    return (
      items.find((s) => s.id === id) || (current?.id === id ? current : null)
    );
  }
  async function refresh(append = false) {
    const version = ++epoch;
    const data = await json(
      `/sessions?archived=${archived}&offset=${append ? offset : 0}&limit=50`,
    );
    if (version !== epoch) return;
    items = append ? [...items, ...data.items] : data.items;
    offset = append ? offset + data.items.length : data.items.length;
    more = data.items.length === 50;
    current = items.find((s) => s.id === selectedId) || current;
    render();
  }
  async function update(id, changes) {
    const session = await json(`/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
    if (id === selectedId) current = session;
    await refresh();
    if (changes.archived !== undefined && id === selectedId)
      await onSelect(null);
    return session;
  }
  $("more-sessions").addEventListener("click", () =>
    refresh(true).catch((error) => showError("chat-error", errorText(error))),
  );
  for (const [id, value] of [
    ["history-active", false],
    ["history-archived", true],
  ])
    $(id).addEventListener("click", () => {
      archived = value;
      refresh().catch((error) => showError("chat-error", errorText(error)));
    });
  render();
  return {
    refresh,
    get,
    update,
    select(id) {
      selectedId = id;
      render();
    },
    add(session) {
      current = session;
      selectedId = session.id;
      if (!!session.archived === archived)
        items = [session, ...items.filter((s) => s.id !== session.id)];
      render();
    },
  };
}
