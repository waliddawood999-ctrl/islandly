const { spawn } = require("child_process");
const { randomUUID } = require("crypto");
// Jobs come only from an explicit user command or a named file action; no command is derived from notification text.
class Jobs {
  constructor(onChange, onDone) {
    this.jobs = new Map();
    this.onChange = onChange;
    this.onDone = onDone;
  }
  list() {
    return [...this.jobs.values()]
      .map(({ process, ...j }) => ({ ...j }))
      .reverse();
  }
  start(label, file, args = [], options = {}) {
    if (this.list().filter((j) => j.status === "running").length >= 3)
      throw new Error("Three jobs are already running");
    const id = randomUUID();
    const job = {
      id,
      label: String(label).slice(0, 120),
      status: "running",
      started: Date.now(),
      progress: null,
      output: "",
      exitCode: null,
    };
    this.jobs.set(id, job);
    while (this.jobs.size > 30) {
      const old = [...this.jobs].find(([, j]) => j.status !== "running");
      if (!old) break;
      this.jobs.delete(old[0]);
    }
    const child = spawn(file, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    job.process = child;
    const append = (c) => {
      job.output = (job.output + c.toString()).slice(-4000);
      const m = job.output.match(/(?:^|\r|\n).*?(\d{1,3})%[^%]*$/);
      if (m) job.progress = Math.min(100, Number(m[1]));
      this.onChange(this.list());
    };
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    const finish = (status, code) => {
      if (job.status !== "running") return;
      job.status = status;
      job.exitCode = code;
      job.finished = Date.now();
      delete job.process;
      this.onChange(this.list());
      this.onDone(job);
    };
    child.on("error", (e) => {
      job.output = e.message;
      finish("failed", null);
    });
    child.on("close", (code) =>
      finish(
        job.cancelled ? "cancelled" : code === 0 ? "done" : "failed",
        code,
      ),
    );
    this.onChange(this.list());
    return id;
  }
  cancel(id) {
    const j = this.jobs.get(id);
    if (j?.process) {
      j.cancelled = true;
      j.process.kill();
    }
  }
  stop() {
    for (const j of this.jobs.values())
      if (j.process) {
        j.cancelled = true;
        j.process.kill();
      }
  }
}
module.exports = { Jobs };
