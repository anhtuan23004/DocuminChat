export async function request(path, options = {}) {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    signal: options.signal || AbortSignal.timeout(30_000),
    headers:
      options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json", ...options.headers }
        : options.headers,
  });
  if (!response.ok) {
    let message = `Backend trả lỗi (${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      /* Proxy errors need not contain JSON. */
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response;
}
export async function json(path, options) {
  const response = await request(path, options);
  return response.status === 204 ? null : response.json();
}
export function errorText(error) {
  if (error.name === "TypeError" || error.name === "TimeoutError")
    return "Chưa kết nối được backend. Kiểm tra stack Docker và thử lại.";
  return error.message;
}
