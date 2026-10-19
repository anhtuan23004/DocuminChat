import { test } from "node:test";
import assert from "node:assert/strict";
import { readEvents } from "../src/stream.js";

function response(text, split = 1) {
  const bytes = new TextEncoder().encode(text);
  return {
    body: new ReadableStream({
      start(c) {
        for (let i = 0; i < bytes.length; i += split)
          c.enqueue(bytes.slice(i, i + split));
        c.close();
      },
    }),
  };
}
test("split frames and Vietnamese UTF-8 survive byte boundaries", async () => {
  const events = [];
  await readEvents(
    response(
      'event: delta\r\ndata: {"text":"Tiếng Việt"}\r\n\r\nevent: done\ndata: {"message_id":"1"}\n\n',
    ),
    (e) => events.push(e),
  );
  assert.equal(events[0].data.text, "Tiếng Việt");
  assert.equal(events[1].type, "done");
});
test("EOF without done never completes a turn", async () => {
  await assert.rejects(
    () =>
      readEvents(
        response('event: delta\ndata: {"text":"partial"}\n\n'),
        () => {},
      ),
    /gián đoạn/,
  );
});
test("server error is surfaced and malformed JSON rejects", async () => {
  await assert.rejects(
    () =>
      readEvents(
        response('event: error\ndata: {"message":"offline"}\n\n'),
        () => {},
      ),
    /offline/,
  );
  await assert.rejects(() =>
    readEvents(response("event: done\ndata: invalid\n\n"), () => {}),
  );
});
test("abort cancels reader", async () => {
  let cancelled = false;
  const controller = new AbortController();
  const body = new ReadableStream({
    start(c) {
      c.enqueue(
        new TextEncoder().encode('event: delta\ndata: {"text":"x"}\n\n'),
      );
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    () => readEvents({ body }, () => controller.abort(), controller.signal),
    { name: "AbortError" },
  );
  assert.equal(cancelled, true);
});
