export class ViewState {
  sessionId = null;
  epoch = 0;
  controller = null;
  select(id) {
    this.controller?.abort();
    this.controller = null;
    this.sessionId = id;
    return ++this.epoch;
  }
  current(epoch) {
    return this.epoch === epoch;
  }
}
