import { json, errorText } from "./api.js";
import { $, element, icon, showError } from "./dom.js";

export function projectPanel(onChoose) {
  let items = [],
    selectedId = null,
    offset = 0,
    more = false,
    epoch = 0,
    expanded = false;
  function render() {
    $("project-list").replaceChildren();
    $("session-project").replaceChildren(
      element("option", "", "Không thuộc Project"),
    );
    $("session-project").firstChild.value = "";
    let visible = expanded ? items : items.slice(0, 6);
    const selected = items.find((p) => p.id === selectedId);
    if (selected && !visible.includes(selected))
      visible = [selected, ...visible.slice(0, 5)];
    for (const project of visible) {
      const button = element(
        "button",
        `project-item${project.id === selectedId ? " active" : ""}`,
      );
      button.append(icon("folder"), element("span", "", project.name));
      button.setAttribute("aria-label", project.name);
      if (project.id === selectedId)
        button.setAttribute("aria-current", "page");
      button.addEventListener("click", () =>
        onChoose(project).catch((error) =>
          showError("chat-error", errorText(error)),
        ),
      );
      $("project-list").append(button);
    }
    for (const project of items) {
      const option = element("option", "", project.name);
      option.value = project.id;
      $("session-project").append(option);
    }
    $("session-project").value = selectedId || "";
    $("more-projects").hidden = !more && visible.length === items.length;
  }
  async function refresh(append = false) {
    const version = ++epoch;
    const data = await json(`/projects?offset=${append ? offset : 0}&limit=50`);
    if (version !== epoch) return;
    const combined = append ? [...items, ...data.items] : data.items;
    items = [...new Map(combined.map((p) => [p.id, p])).values()];
    offset = append ? offset + data.items.length : data.items.length;
    more = data.items.length === 50;
    render();
  }
  $("more-projects").addEventListener("click", () => {
    if (!expanded && items.length > 6) {
      expanded = true;
      render();
    } else
      refresh(true).catch((error) => showError("chat-error", errorText(error)));
  });
  $("new-project").addEventListener("click", () => {
    $("project-name-input").value = "";
    showError("project-error");
    $("project-dialog").showModal();
    $("project-name-input").focus();
  });
  $("project-cancel").addEventListener("click", () =>
    $("project-dialog").close(),
  );
  $("project-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("project-create").disabled = true;
    try {
      const project = await json("/projects", {
        method: "POST",
        body: JSON.stringify({ name: $("project-name-input").value.trim() }),
      });
      ++epoch;
      items.unshift(project);
      selectedId = project.id;
      render();
      $("project-dialog").close();
      await onChoose(project);
    } catch (error) {
      showError(
        $("project-dialog").open ? "project-error" : "chat-error",
        errorText(error),
      );
    } finally {
      $("project-create").disabled = false;
    }
  });
  render();
  return {
    refresh,
    get(id) {
      return items.find((p) => p.id === id);
    },
    select(id) {
      selectedId = id;
      render();
    },
    async resolve(id) {
      if (!id) return null;
      let project = items.find((p) => p.id === id);
      if (!project) {
        project = await json(`/projects/${id}`);
        items.push(project);
        render();
      }
      return project;
    },
  };
}
