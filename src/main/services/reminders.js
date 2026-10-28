const { jsonStore } = require("./store");
const { randomUUID } = require("crypto");
class Reminders {
  constructor(onDue) {
    this.store = jsonStore("reminders.json", []);
    const saved = this.store.read();
    this.items = Array.isArray(saved)
      ? saved
          .filter(
            (x) =>
              typeof x.id === "string" &&
              Number.isFinite(x.at) &&
              typeof x.text === "string",
          )
          .slice(0, 50)
      : [];
    this.onDue = onDue;
    this.timer = setInterval(() => this.tick(), 1000);
  }
  add(minutes, text) {
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 43200)
      throw new Error("Invalid reminder time");
    const item = {
      id: randomUUID(),
      at: Date.now() + minutes * 60000,
      text: String(text || "Reminder").slice(0, 200),
    };
    this.items.push(item);
    this.items = this.items.slice(-50);
    this.store.write(this.items);
    return item;
  }
  tick() {
    const due = this.items.filter((x) => x.at <= Date.now());
    if (!due.length) return;
    this.items = this.items.filter((x) => x.at > Date.now());
    this.store.write(this.items);
    due.forEach(this.onDue);
  }
  list() {
    return this.items.slice().sort((a, b) => a.at - b.at);
  }
  remove(id) {
    this.items = this.items.filter((x) => x.id !== id);
    this.store.write(this.items);
  }
  stop() {
    clearInterval(this.timer);
  }
}
module.exports = { Reminders };
