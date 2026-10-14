import { test } from "node:test";
import assert from "node:assert/strict";
import { Drafts } from "../src/drafts.js";
test("project and standalone drafts are distinct and migrate into their new session", () => {
  const drafts = new Drafts();
  const p = drafts.key(null, "p"),
    home = drafts.key(null, null),
    chat = drafts.key("s", "p");
  drafts.set(p, "project draft");
  drafts.set(home, "personal draft");
  drafts.move(p, chat);
  assert.equal(drafts.get(chat), "project draft");
  assert.equal(drafts.get(home), "personal draft");
  assert.equal(drafts.get(p), "");
});
