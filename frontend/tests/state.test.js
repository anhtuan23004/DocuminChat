import { test } from "node:test";
import assert from "node:assert/strict";
import { ViewState } from "../src/state.js";
test("switching sessions aborts generation and invalidates late results, including switching back", () => {
  const state = new ViewState(),
    old = state.select("a");
  const controller = new AbortController();
  state.controller = controller;
  state.select("b");
  state.select("a");
  assert.equal(controller.signal.aborted, true);
  assert.equal(state.current(old), false);
  assert.equal(state.controller, null);
});
