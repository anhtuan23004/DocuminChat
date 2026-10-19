import { json } from "./api.js";
import { $, element } from "./dom.js";

const CONFIG_STORAGE_KEY = "documinchat-pipeline-config-v1";

export const DEFAULT_PRESETS = {
  "preset-b": {
    id: "preset-b",
    name: "Preset 2: Hybrid RRF v2",
    pills: ["800 / 120c", "Hybrid · K=4", "Lost-in-Middle", "Summary + 4t", "CoT v2 · T=0.0"],
    config: {
      preset_id: "preset-b",
      chunk_strategy: "page_aware",
      chunk_size: 800,
      chunk_overlap: 120,
      keep_heading: true,
      rag_mode: "hybrid",
      query_rewrite: "multi_query",
      top_k: 4,
      min_score: 0.35,
      reranker: true,
      context_ordering: "lost_in_middle",
      max_context_chars: 12000,
      context_format: "xml",
      deduplicate: true,
      memory_mode: "summary_buffer",
      window_turns: 4,
      max_memory_chars: 2400,
      resolve_pronouns: true,
      prompt_template: "analytical_cot_v2",
      system_prompt:
        "Bạn là chuyên gia phân tích tài liệu DocuminChat.\n1. Tách câu hỏi thành từng ý nhỏ và trả lời dựa trên {{DOCUMENTS}}.\n2. Mọi số liệu, tỷ lệ %, thời hạn bắt buộc gắn trích dẫn [1], [2].\n3. Tuyệt đối không suy diễn ngoài tài liệu.",
      temperature: 0.0,
      top_p: 0.85,
      enforce_citations: true,
    },
  },
  "preset-a": {
    id: "preset-a",
    name: "Preset 1: Baseline Lexical v1",
    pills: ["800 / 120c", "Lexical · K=3", "Top-Down", "Sliding 4t", "Strict v1 · T=0.1"],
    config: {
      preset_id: "preset-a",
      chunk_strategy: "recursive",
      chunk_size: 800,
      chunk_overlap: 120,
      keep_heading: false,
      rag_mode: "lexical",
      query_rewrite: "raw",
      top_k: 3,
      min_score: 0.2,
      reranker: false,
      context_ordering: "top_down",
      max_context_chars: 8000,
      context_format: "xml",
      deduplicate: false,
      memory_mode: "sliding_window",
      window_turns: 4,
      max_memory_chars: 1600,
      resolve_pronouns: false,
      prompt_template: "strict_grounded_v1",
      system_prompt:
        "Bạn là trợ lý DocuminChat. Chỉ dùng dữ kiện được tài liệu hỗ trợ trong {{DOCUMENTS}} và trích nguồn [1], [2]. Nếu thiếu thông tin hãy nói rõ.",
      temperature: 0.1,
      top_p: 0.9,
      enforce_citations: true,
    },
  },
  "preset-c": {
    id: "preset-c",
    name: "Preset 3: Strict Legal Audit v3",
    pills: ["600 / 150c", "Hybrid · K=6", "Lost-in-Middle", "Summary + 6t", "Audit v3 · T=0.0"],
    config: {
      preset_id: "preset-c",
      chunk_strategy: "page_aware",
      chunk_size: 600,
      chunk_overlap: 150,
      keep_heading: true,
      rag_mode: "hybrid",
      query_rewrite: "multi_query",
      top_k: 6,
      min_score: 0.4,
      reranker: true,
      context_ordering: "lost_in_middle",
      max_context_chars: 16000,
      context_format: "xml",
      deduplicate: true,
      memory_mode: "summary_buffer",
      window_turns: 6,
      max_memory_chars: 3600,
      resolve_pronouns: true,
      prompt_template: "strict_grounded_v1",
      system_prompt:
        "Bạn là chuyên viên kiểm toán pháp lý DocuminChat. Đối chiếu nghiêm ngặt từng điều khoản trong {{DOCUMENTS}}, trích dẫn chính xác [1], [2] kèm số trang.",
      temperature: 0.0,
      top_p: 0.8,
      enforce_citations: true,
    },
  },
};

const STUDIO_MODULES = {
  chunking: {
    title: "1. Chunking & Ingestion (Cắt đoạn & Xử lý Tài liệu)",
    desc: "Cấu hình kích thước đoạn cắt (chunk_size), độ gối (overlap) và bảo toàn cấu trúc mục/trang.",
    impact: "Giữ tiêu đề mục cha + 800/120 ký tự giúp tránh đứt gãy bảng biểu và điều khoản dài.",
  },
  rag: {
    title: "2. RAG & Retrieval (Truy xuất & Biến đổi Câu hỏi)",
    desc: "Quyết định kỹ thuật tìm kiếm (Lexical / Hybrid RRF), Query Rewrite và ngưỡng lọc Top-K.",
    impact: "Hybrid RRF + Multi-Query giúp tăng +40% Recall trên câu hỏi nhiều vế.",
  },
  context: {
    title: "3. Context Engineering (Đóng gói & Sắp xếp Ngữ cảnh)",
    desc: "Tối ưu cách sắp xếp thứ tự các đoạn tài liệu (Lost-in-the-Middle) và ngân sách ký tự.",
    impact: "Đặt đoạn quan trọng ở Đầu & Cuối khối <DOCUMENTS> giúp tăng độ chính xác trích dẫn.",
  },
  memory: {
    title: "4. Memory (Quản lý Bộ nhớ Hội thoại)",
    desc: "Kiểm soát cửa sổ lịch sử hội thoại, nén tóm tắt lượt cũ và giải chiếu đại từ.",
    impact: "Summary Buffer + 4 lượt giúp tiết kiệm 70% token lịch sử mà không mất mạch hội thoại.",
  },
  prompt: {
    title: "5. Prompt & Generator (Chỉ dẫn Hệ thống & Tham số LLM)",
    desc: "Thiết lập khuôn mẫu System Prompt, quy tắc trích dẫn [1], [2] và nhiệt độ sinh văn bản.",
    impact: "Analytical Step-by-Step v2 + Temperature 0.0 đảm bảo Faithfulness đạt 3/3.",
  },
};

export function getActivePipelineConfig() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_PRESETS["preset-b"].config, ...JSON.parse(raw) };
      }
    }
  } catch {}
  return { ...DEFAULT_PRESETS["preset-b"].config };
}

export function saveActivePipelineConfig(cfg) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
    }
  } catch {}
}

export function initStudio(docs, trace, openDocuments) {
  let activeConfig = getActivePipelineConfig();
  let studioTab = "rag";
  let studioSubtab = "params";

  function updatePillsFromConfig(cfg) {
    if ($("pill-mod-1")) {
      $("pill-mod-1").textContent = `${cfg.chunk_size} / ${cfg.chunk_overlap}c`;
    }
    if ($("pill-mod-2")) {
      const modeLabel =
        cfg.rag_mode === "hybrid" ? "Hybrid" : cfg.rag_mode === "dense" ? "Dense" : "Lexical";
      $("pill-mod-2").textContent = `${modeLabel} · K=${cfg.top_k}`;
    }
    if ($("pill-mod-3")) {
      const ordLabel =
        cfg.context_ordering === "lost_in_middle"
          ? "Lost-in-Middle"
          : cfg.context_ordering === "page_order"
            ? "Page-Order"
            : "Top-Down";
      $("pill-mod-3").textContent = ordLabel;
    }
    if ($("pill-mod-4")) {
      const memLabel =
        cfg.memory_mode === "stateless"
          ? "Stateless"
          : cfg.memory_mode === "sliding_window"
            ? `Sliding ${cfg.window_turns}t`
            : `Summary + ${cfg.window_turns}t`;
      $("pill-mod-4").textContent = memLabel;
    }
    if ($("pill-mod-5")) {
      $("pill-mod-5").textContent = `T=${Number(cfg.temperature).toFixed(1)}`;
    }
  }

  function syncFormInputs(cfg) {
    if ($("drawer-preset-select")) $("drawer-preset-select").value = cfg.preset_id || "preset-b";
    if ($("studio-preset-select")) $("studio-preset-select").value = cfg.preset_id || "preset-b";

    const setVal = (id, val, outId, unit = "") => {
      const el = $(id);
      if (el) el.value = String(val);
      const out = outId ? $(outId) : null;
      if (out) out.textContent = `${val}${unit}`;
    };

    setVal("dr-chunk-strategy", cfg.chunk_strategy);
    setVal("dr-chunk-size", cfg.chunk_size, "dr-val-chunk", " ký tự");
    setVal("dr-chunk-overlap", cfg.chunk_overlap, "dr-val-overlap", " ký tự");
    if ($("dr-keep-heading")) $("dr-keep-heading").checked = Boolean(cfg.keep_heading);

    setVal("dr-rag-mode", cfg.rag_mode);
    setVal("dr-rag-rewrite", cfg.query_rewrite);
    setVal("dr-rag-topk", cfg.top_k, "dr-val-topk", " đoạn");
    setVal("dr-rag-score", cfg.min_score, "dr-val-score", "");
    if ($("dr-rag-reranker")) $("dr-rag-reranker").checked = Boolean(cfg.reranker);

    setVal("dr-ctx-order", cfg.context_ordering);
    setVal("dr-ctx-budget", cfg.max_context_chars, "dr-val-ctx", " ký tự");
    setVal("dr-ctx-fmt", cfg.context_format);
    if ($("dr-ctx-dedup")) $("dr-ctx-dedup").checked = Boolean(cfg.deduplicate);

    setVal("dr-mem-mode", cfg.memory_mode);
    setVal("dr-mem-turns", cfg.window_turns, "dr-val-mem", " lượt");
    setVal("dr-mem-chars", cfg.max_memory_chars, "dr-val-memc", " ký tự");
    if ($("dr-mem-pronoun")) $("dr-mem-pronoun").checked = Boolean(cfg.resolve_pronouns);

    setVal("dr-prm-tpl", cfg.prompt_template);
    setVal("dr-prm-text", cfg.system_prompt || "");
    setVal("dr-prm-temp", cfg.temperature, "dr-val-temp", "");
    setVal("dr-prm-topp", cfg.top_p, "dr-val-topp", "");

    updatePillsFromConfig(cfg);
  }

  function readFormIntoConfig() {
    activeConfig = {
      ...activeConfig,
      preset_id: $("drawer-preset-select")?.value || activeConfig.preset_id || "preset-b",
      chunk_strategy: $("dr-chunk-strategy")?.value || "page_aware",
      chunk_size: Number($("dr-chunk-size")?.value || 800),
      chunk_overlap: Number($("dr-chunk-overlap")?.value || 120),
      keep_heading: Boolean($("dr-keep-heading")?.checked ?? true),
      rag_mode: $("dr-rag-mode")?.value || "hybrid",
      query_rewrite: $("dr-rag-rewrite")?.value || "multi_query",
      top_k: Number($("dr-rag-topk")?.value || 4),
      min_score: Number($("dr-rag-score")?.value || 0.35),
      reranker: Boolean($("dr-rag-reranker")?.checked ?? true),
      context_ordering: $("dr-ctx-order")?.value || "lost_in_middle",
      max_context_chars: Number($("dr-ctx-budget")?.value || 12000),
      context_format: $("dr-ctx-fmt")?.value || "xml",
      deduplicate: Boolean($("dr-ctx-dedup")?.checked ?? true),
      memory_mode: $("dr-mem-mode")?.value || "summary_buffer",
      window_turns: Number($("dr-mem-turns")?.value || 4),
      max_memory_chars: Number($("dr-mem-chars")?.value || 2400),
      resolve_pronouns: Boolean($("dr-mem-pronoun")?.checked ?? true),
      prompt_template: $("dr-prm-tpl")?.value || "analytical_cot_v2",
      system_prompt: $("dr-prm-text")?.value || "",
      temperature: Number($("dr-prm-temp")?.value || 0.0),
      top_p: Number($("dr-prm-topp")?.value || 0.85),
    };
    updatePillsFromConfig(activeConfig);
    saveActivePipelineConfig(activeConfig);
    return activeConfig;
  }

  function selectPreset(presetId) {
    const preset = DEFAULT_PRESETS[presetId] || DEFAULT_PRESETS["preset-b"];
    activeConfig = { ...preset.config };
    saveActivePipelineConfig(activeConfig);
    syncFormInputs(activeConfig);
    renderStudioModal();
  }

  function renderStudioModal() {
    document.querySelectorAll("[data-studio-tab]").forEach((btn) => {
      const isSelected = btn.dataset.studioTab === studioTab;
      btn.classList.toggle("active", isSelected);
      btn.setAttribute("aria-selected", String(isSelected));
    });

    const isAb = studioTab === "ab";
    if ($("studio-mod-view")) $("studio-mod-view").hidden = isAb;
    if ($("studio-ab-view")) $("studio-ab-view").hidden = !isAb;
    if (isAb) return;

    const meta = STUDIO_MODULES[studioTab] || STUDIO_MODULES.rag;
    if ($("studio-mod-heading")) $("studio-mod-heading").textContent = meta.title;
    if ($("studio-mod-desc")) $("studio-mod-desc").textContent = meta.desc;
    if ($("studio-mod-impact")) $("studio-mod-impact").textContent = meta.impact;

    document.querySelectorAll("[data-studio-subtab]").forEach((btn) => {
      if (btn.getAttribute("role") === "tab") {
        const active = btn.dataset.studioSubtab === studioSubtab;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", String(active));
      }
    });
    if ($("studio-params-pane")) $("studio-params-pane").hidden = studioSubtab !== "params";
    if ($("studio-sandbox-pane")) $("studio-sandbox-pane").hidden = studioSubtab !== "sandbox";

    renderStudioParamsPane(studioTab);
  }

  function renderStudioParamsPane(tab) {
    const pane = $("studio-params-pane");
    if (!pane) return;
    const cfg = activeConfig;
    if (tab === "chunking") {
      pane.innerHTML = `
        <div class="studio-setting-row">
          <div>
            <strong>Chiến lược cắt đoạn (Chunking Strategy)</strong>
            <p class="studio-muted">Chọn phương pháp tách văn bản khi nạp PDF / TXT.</p>
          </div>
          <select id="st-chunk-strategy" class="drawer-select" style="max-width:260px">
            <option value="page_aware" ${cfg.chunk_strategy === "page_aware" ? "selected" : ""}>Theo cấu trúc Trang & Mục</option>
            <option value="recursive" ${cfg.chunk_strategy === "recursive" ? "selected" : ""}>Recursive Character</option>
            <option value="semantic" ${cfg.chunk_strategy === "semantic" ? "selected" : ""}>Semantic Breakpoint</option>
          </select>
        </div>
        <div class="studio-setting-row">
          <div>
            <strong>Kích thước đoạn (<code>chunk_size</code>)</strong>
            <p class="studio-muted">Độ dài mục tiêu của mỗi đoạn văn bản (${cfg.chunk_size} ký tự).</p>
          </div>
          <span class="studio-val-badge">${cfg.chunk_size} ký tự · Overlap ${cfg.chunk_overlap}c</span>
        </div>`;
    } else if (tab === "rag") {
      pane.innerHTML = `
        <div class="studio-setting-row">
          <div>
            <strong>Phương pháp Truy xuất (Retrieval Technique)</strong>
            <p class="studio-muted">Kết hợp từ khóa chính xác (NFKC/BM25) và ngữ nghĩa (Hybrid RRF).</p>
          </div>
          <span class="studio-val-badge">${cfg.rag_mode.toUpperCase()} · Top-${cfg.top_k}</span>
        </div>
        <div class="studio-setting-row">
          <div>
            <strong>Biến đổi câu hỏi (Query Rewrite)</strong>
            <p class="studio-muted">Mở rộng từ đồng nghĩa và tách câu hỏi nhiều vế trước khi quét chunks.</p>
          </div>
          <span class="studio-val-badge">${cfg.query_rewrite}</span>
        </div>`;
    } else if (tab === "context") {
      pane.innerHTML = `
        <div class="studio-setting-row">
          <div>
            <strong>Sắp xếp Ngữ cảnh (Context Ordering)</strong>
            <p class="studio-muted">Đặt đoạn quan trọng nhất ở Đầu và Cuối khối &lt;DOCUMENTS&gt; để tránh Lost-in-the-Middle.</p>
          </div>
          <span class="studio-val-badge">${cfg.context_ordering}</span>
        </div>
        <div class="studio-setting-row">
          <div>
            <strong>Ngân sách Ngữ cảnh tối đa (<code>max_context_chars</code>)</strong>
            <p class="studio-muted">Giới hạn tổng số ký tự tài liệu đóng gói vào System Prompt.</p>
          </div>
          <span class="studio-val-badge">${cfg.max_context_chars.toLocaleString("vi-VN")} ký tự</span>
        </div>`;
    } else if (tab === "memory") {
      pane.innerHTML = `
        <div class="studio-setting-row">
          <div>
            <strong>Cơ chế Bộ nhớ Hội thoại (Memory Strategy)</strong>
            <p class="studio-muted">Tóm tắt lượt cũ và giữ nguyên văn ${cfg.window_turns} lượt gần nhất.</p>
          </div>
          <span class="studio-val-badge">${cfg.memory_mode} (${cfg.window_turns} lượt)</span>
        </div>`;
    } else {
      pane.innerHTML = `
        <div class="studio-setting-row">
          <div>
            <strong>Khuôn mẫu System Prompt & Nhiệt độ</strong>
            <p class="studio-muted">Mẫu ${cfg.prompt_template} · Temperature = ${cfg.temperature} · Top-P = ${cfg.top_p}.</p>
          </div>
          <span class="studio-val-badge">T = ${cfg.temperature}</span>
        </div>
        <pre class="trace-prompt-pre">${(cfg.system_prompt || "").replace(/</g, "&lt;")}</pre>`;
    }
  }

  async function runSandboxPreview() {
    const out = $("studio-sandbox-output");
    if (!out) return;
    out.textContent = "Đang chạy thử nghiệm Sandbox trên cấu hình hiện tại…";
    try {
      const res = await json("/eval/sandbox", {
        method: "POST",
        body: JSON.stringify({
          module: studioTab,
          query:
            $("ab-query-input")?.value ||
            "Mức phạt vi phạm SLA khi hệ thống gián đoạn quá 4 giờ và thời hạn thanh toán?",
          document_ids: [...(docs?.selected || [])],
          config_b: activeConfig,
        }),
      });
      out.textContent = JSON.stringify(
        {
          module: res.module,
          matched_chunks: res.trace?.matched_chunks ?? 0,
          selected_chunks: res.trace?.selected_chunks ?? 0,
          retrieve_ms: res.trace?.retrieve_ms ?? 0,
          query_terms: res.trace?.query_terms ?? [],
          packed_context_preview: (res.packed_context || "").slice(0, 400),
        },
        null,
        2,
      );
    } catch {
      out.textContent = `[Sandbox Preview — ${studioTab.toUpperCase()}]\nPreset: ${activeConfig.preset_id}\nRAG: ${activeConfig.rag_mode} (Top-${activeConfig.top_k})\nContext: ${activeConfig.context_ordering} (${activeConfig.max_context_chars} ký tự)`;
    }
  }

  function openStudioModal(initialTab = "rag") {
    studioTab = initialTab || "rag";
    studioSubtab = "params";
    renderStudioModal();
    const dlg = $("studio-dialog");
    if (dlg && !dlg.open) {
      dlg.showModal();
    }
  }

  function closeStudioModal() {
    const dlg = $("studio-dialog");
    if (dlg?.open) dlg.close();
  }

  // Bind Right Rail buttons
  document.querySelectorAll("[data-rail]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.rail;
      const panel = $("documents-panel");
      const currentActive =
        targetTab === "params"
          ? !$("panel-params-body")?.hidden
          : targetTab === "trace"
            ? !$("panel-trace-body")?.hidden
            : !$("panel-docs-body")?.hidden;
      if (panel?.open && currentActive) {
        panel.close();
        return;
      }
      openDocuments();
      trace.setPanelTab(targetTab);
    });
  });

  // Bind inputs inside #panel-params-body
  $("drawer-preset-select")?.addEventListener("change", (e) => {
    selectPreset(e.target.value);
  });
  $("studio-preset-select")?.addEventListener("change", (e) => {
    selectPreset(e.target.value);
  });

  $("panel-params-body")?.addEventListener("input", (e) => {
    const target = e.target;
    if (target.dataset?.slider) {
      const out = $(target.dataset.slider);
      if (out) out.textContent = `${target.value}${target.dataset.unit || ""}`;
    }
    readFormIntoConfig();
  });

  $("btn-drawer-save")?.addEventListener("click", () => {
    readFormIntoConfig();
    const tag = $("drawer-preset-tag");
    if (tag) {
      tag.textContent = "Đã lưu Preset";
      setTimeout(() => {
        tag.textContent = "Đang áp dụng";
      }, 1500);
    }
  });

  $("btn-drawer-apply")?.addEventListener("click", () => {
    readFormIntoConfig();
    const btn = $("btn-drawer-apply");
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = "✓ Đã áp dụng";
      setTimeout(() => {
        btn.textContent = orig;
      }, 1400);
    }
  });

  $("btn-open-ab-studio")?.addEventListener("click", () => openStudioModal("ab"));
  $("btn-open-full-studio")?.addEventListener("click", () => openStudioModal("rag"));
  $("btn-studio-close")?.addEventListener("click", closeStudioModal);
  $("btn-studio-apply")?.addEventListener("click", () => {
    readFormIntoConfig();
    closeStudioModal();
  });

  document.querySelectorAll("[data-studio-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      studioTab = btn.dataset.studioTab;
      studioSubtab = "params";
      renderStudioModal();
    });
  });

  document.querySelectorAll("[data-studio-subtab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      studioSubtab = btn.dataset.studioSubtab;
      renderStudioModal();
      if (studioSubtab === "sandbox") runSandboxPreview();
    });
  });

  $("btn-run-ab")?.addEventListener("click", async () => {
    const btn = $("btn-run-ab");
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = "Đang chạy A & B…";
    try {
      const res = await json("/eval/sandbox", {
        method: "POST",
        body: JSON.stringify({
          module: "ab",
          query:
            $("ab-query-input")?.value ||
            "Mức phạt vi phạm SLA khi hệ thống gián đoạn quá 4 giờ và thời hạn thanh toán?",
          document_ids: [...(docs?.selected || [])],
          config_a: DEFAULT_PRESETS["preset-a"].config,
          config_b: activeConfig,
        }),
      });
      if (res?.column_b?.rag_triad && $("ab-triad-b-score")) {
        $("ab-triad-b-score").textContent = `${res.column_b.rag_triad.total} / 9 điểm · Tối ưu`;
      }
    } catch {}
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "Chạy đối chiếu A/B";
    }, 350);
  });

  document.querySelectorAll("[data-triad]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = btn.dataset.triad;
      document
        .querySelectorAll(`[data-triad="${group}"]`)
        .forEach((b) => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
    });
  });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === ",") {
      e.preventDefault();
      const dlg = $("studio-dialog");
      if (dlg?.open) closeStudioModal();
      else openStudioModal("rag");
    }
  });

  syncFormInputs(activeConfig);

  return {
    getConfig: () => readFormIntoConfig(),
    openStudioModal,
  };
}
