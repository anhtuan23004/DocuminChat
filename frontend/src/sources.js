import { json, errorText } from "./api.js";
import { $, element, showError } from "./dom.js";

export function sourcePanel() {
  let sourceEpoch = 0;
  function sources(refs) {
    const epoch = ++sourceEpoch;
    $("source-count").textContent = refs.length;
    $("source-list").replaceChildren();
    if (!refs.length)
      $("source-list").append(
        element(
          "p",
          "empty-sources",
          "Các đoạn trích sẽ xuất hiện ở đây khi câu trả lời sử dụng tài liệu.",
        ),
      );
    refs.forEach((source, index) => {
      const card = element("div", "source-card"),
        button = element("button");
      button.type = "button";
      const title = element("span", "source-title", source.name);
      title.append(
        element(
          "span",
          "source-page",
          `Trang ${source.page} · phiên bản ${source.version}`,
        ),
      );
      button.append(element("span", "source-number", `[${index + 1}]`), title);
      const excerpt = element("p", "source-excerpt");
      excerpt.hidden = true;
      button.setAttribute("aria-expanded", "false");
      button.addEventListener("click", async () => {
        if (!excerpt.hidden) {
          excerpt.hidden = true;
          button.setAttribute("aria-expanded", "false");
          return;
        }
        try {
          const data = await json(`/sources/${source.chunk_id}`);
          if (epoch !== sourceEpoch) return;
          excerpt.textContent = data.text;
          excerpt.hidden = false;
          button.setAttribute("aria-expanded", "true");
        } catch (error) {
          if (epoch === sourceEpoch)
            showError("document-error", errorText(error));
        }
      });
      card.append(button, excerpt);
      $("source-list").append(card);
    });
  }

  return sources;
}
