export class Drafts {
  values = new Map();
  key(sessionId, projectId) {
    return sessionId ? `session:${sessionId}` : `new:${projectId || "home"}`;
  }
  get(key) {
    return this.values.get(key) || "";
  }
  set(key, value) {
    value ? this.values.set(key, value) : this.values.delete(key);
  }
  move(from, to) {
    this.set(to, this.get(from));
    this.values.delete(from);
  }
}
