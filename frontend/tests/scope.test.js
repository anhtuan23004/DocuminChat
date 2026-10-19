import { test } from "node:test";
import assert from "node:assert/strict";
import { DocumentScope } from "../src/scope.js";
test("session context takes priority over project and invalidates stale responses", () => {
  const scope = new DocumentScope();
  const old = scope.set({ projectId: "p", sessionId: null });
  assert.equal(scope.query(), "project_id=p");
  scope.set({ sessionId: "s" });
  assert.equal(scope.query(), "session_id=s");
  assert.equal(scope.current(old), false);
  scope.set({ projectId: null, sessionId: null });
  assert.equal(scope.query(), null);
});
