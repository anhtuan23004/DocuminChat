export class DocumentScope {
  epoch = 0;
  value = { projectId: null, sessionId: null, projectName: "", mode: "chat" };
  set(value) {
    this.value = { ...this.value, ...value };
    return ++this.epoch;
  }
  current(epoch) {
    return this.epoch === epoch;
  }
  query() {
    if (this.value.sessionId)
      return `session_id=${encodeURIComponent(this.value.sessionId)}`;
    if (this.value.projectId)
      return `project_id=${encodeURIComponent(this.value.projectId)}`;
    return null;
  }
}
