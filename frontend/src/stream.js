export async function readEvents(response, onEvent, signal) {
  if (!response.body) throw new Error("Backend không trả stream.");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    finished = false;
  const abort = () => reader.cancel().catch(() => {});
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (!finished) {
      if (signal?.aborted) throw new DOMException("Đã dừng", "AbortError");
      const { value, done } = await reader.read();
      if (signal?.aborted) throw new DOMException("Đã dừng", "AbortError");
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 1_000_000)
        throw new Error("Dữ liệu stream vượt giới hạn.");
      let match;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        let type = "message";
        const lines = [];
        for (const line of frame.split(/\r?\n/)) {
          if (line.startsWith("event:")) type = line.slice(6).trim();
          if (line.startsWith("data:")) lines.push(line.slice(5).trimStart());
        }
        if (!lines.length) continue;
        const data = JSON.parse(lines.join("\n"));
        if (type === "error") throw new Error(data.message || "Model trả lỗi.");
        onEvent({ type, data });
        if (type === "done") {
          finished = true;
          break;
        }
        if (signal?.aborted) throw new DOMException("Đã dừng", "AbortError");
      }
      if (done && !finished)
        throw new Error("Kết nối bị gián đoạn trước khi hoàn tất.");
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
