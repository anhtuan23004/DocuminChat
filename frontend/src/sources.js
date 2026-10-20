import { json, errorText } from "./api.js";
import { $, element, showError } from "./dom.js";

export function sourcePanel() {
  let sourceEpoch = 0;
  function sources(refs, activeIndex = null) {
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
      const card = element(
          "div",
          `source-card ${activeIndex === index ? "highlighted" : ""}`,
        ),
        button = element("button");
      button.type = "button";
      const title = element("span", "source-title", source.name);
      const metaParts = [`Trang ${source.page}`, `phiên bản ${source.version}`];
      if (source.score) metaParts.push(`Khớp ${source.score} từ khóa`);
      if (source.matched_terms?.length)
        metaParts.push(`(${source.matched_terms.join(", ")})`);
      title.append(element("span", "source-page", metaParts.join(" · ")));
      button.append(element("span", "source-number", `[${index + 1}]`), title);
      const excerpt = element("p", "source-excerpt");
      excerpt.hidden = true;
      button.setAttribute("aria-expanded", "false");
      async function toggleExcerpt(forceOpen = false) {
        if (!excerpt.hidden && !forceOpen) {
          excerpt.hidden = true;
          button.setAttribute("aria-expanded", "false");
          return;
        }
        if (source.text && !excerpt.textContent && forceOpen) {
          excerpt.textContent = source.text;
          excerpt.hidden = false;
          button.setAttribute("aria-expanded", "true");
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
      }
      button.addEventListener("click", () => toggleExcerpt(false));
      card.append(button, excerpt);
      $("source-list").append(card);
      if (activeIndex === index) {
        toggleExcerpt(true);
        queueMicrotask(() =>
          card.scrollIntoView({ block: "nearest", behavior: "smooth" }),
        );
      }
    });
  }

  return sources;
}

