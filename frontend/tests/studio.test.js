import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PRESETS, getActivePipelineConfig } from "../src/studio.js";

test("DEFAULT_PRESETS includes all 5 modules and getActivePipelineConfig returns independent copy", () => {
  assert.ok(DEFAULT_PRESETS["preset-b"]);
  assert.ok(DEFAULT_PRESETS["preset-a"]);
  assert.ok(DEFAULT_PRESETS["preset-c"]);
  const cfg = getActivePipelineConfig();
  assert.equal(cfg.preset_id, "preset-b");
  assert.equal(cfg.chunk_strategy, "page_aware");
  assert.equal(cfg.rag_mode, "hybrid");
  assert.equal(cfg.context_ordering, "lost_in_middle");
  assert.equal(cfg.memory_mode, "summary_buffer");
  assert.equal(cfg.enforce_citations, true);
  cfg.top_k = 99;
  assert.notEqual(getActivePipelineConfig().top_k, 99);
});
