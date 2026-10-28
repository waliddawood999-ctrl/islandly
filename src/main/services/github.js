const { net } = require("electron");
const { RequestScope } = require("../request");
const API = process.env.ISLANDLY_GH_API || "https://api.github.com";
function htmlUrl(n) {
  const api = n.subject?.url;
  const m = api && /\/repos\/([^/]+\/[^/]+)\/(pulls|issues)\/(\d+)/.exec(api);
  return m
    ? `https://github.com/${m[1]}/${m[2] === "pulls" ? "pull" : "issues"}/${m[3]}`
    : n.repository?.html_url || "https://github.com/notifications";
}
class GitHubWatcher {
  constructor(getToken, onChange, getRepos = () => "") {
    this.getToken = getToken;
    this.onChange = onChange;
    this.getRepos = getRepos;
    this.scope = new RequestScope();
    this.timer = null;
    this.seen = new Set();
    this.first = true;
    this.busy = false;
    this.restartPending = false;
    this.runs = new Map();
  }
  start() {
    this.stop();
    this.first = true;
    this.seen.clear();
    this.runs.clear();
    if (!this.getToken()) {
      this.onChange({ status: "off", items: [] });
      return;
    }
    if (this.busy) this.restartPending = true;
    else this.poll();
    this.timer = setInterval(() => this.poll(), 3 * 60000);
  }
  stop() {
    this.scope.invalidate();
    this.restartPending = false;
    clearInterval(this.timer);
    this.timer = null;
  }
  async poll() {
    if (this.busy) return;
    const token = this.getToken();
    if (!token) return this.stop();
    this.busy = true;
    const request = this.scope.begin();
    const get = async (endpoint) => {
      const r = await net.fetch(API + endpoint, {
        signal: request.signal,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/vnd.github+json",
          "User-Agent": "Islandly",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!r.ok)
        throw Object.assign(new Error("GitHub HTTP " + r.status), {
          status: r.status,
        });
      return r.json();
    };
    try {
      const list = await get("/notifications?per_page=20");
      if (!Array.isArray(list))
        throw new Error("Unexpected notifications response");
      const items = list.map((n) => ({
        id: String(n.id),
        title: n.subject?.title || "",
        type: n.subject?.type || "",
        repo: n.repository?.full_name || "",
        reason: n.reason || "",
        url: htmlUrl(n),
      }));
      const fresh = this.first ? [] : items.filter((i) => !this.seen.has(i.id));
      let reviews = null,
        runs = [],
        detailsError = false;
      try {
        const user = await get("/user");
        if (!/^[-\w]+$/.test(user.login)) throw new Error("Invalid user");
        const result = await get(
          "/search/issues?q=" +
            encodeURIComponent("is:pr is:open review-requested:" + user.login) +
            "&per_page=1",
        );
        reviews = result.total_count;
      } catch (_) {
        detailsError = true;
      }
      const repos = String(this.getRepos())
        .split(/[\s,]+/)
        .filter((r) => /^[-\w.]+\/[-\w.]+$/.test(r))
        .slice(0, 5);
      for (const repo of repos) {
        try {
          const result = await get(`/repos/${repo}/actions/runs?per_page=3`);
          if (!request.current()) return;
          for (const run of result.workflow_runs || []) {
            const row = {
              id: String(run.id),
              repo,
              title: run.name,
              status: run.status,
              conclusion: run.conclusion,
              url: run.html_url,
            };
            runs.push(row);
            const last = this.runs.get(row.id);
            if (
              !this.first &&
              row.conclusion === "failure" &&
              last !== "failure"
            )
              fresh.push({
                id: "run-" + row.id,
                title: row.title + " — CI failed",
                repo,
                url: row.url,
                type: "CheckSuite",
              });
            this.runs.set(row.id, row.conclusion || row.status);
          }
        } catch (_) {
          detailsError = true;
        }
      }
      if (!request.current()) return;
      items.forEach((i) => this.seen.add(i.id));
      this.seen = new Set([...this.seen].slice(-500));
      this.runs = new Map([...this.runs].slice(-100));
      this.first = false;
      this.onChange({
        status: "ok",
        items,
        fresh,
        reviews,
        runs,
        detailsError,
      });
    } catch (e) {
      if (request.current())
        this.onChange({
          status: e.status === 401 ? "bad-token" : "error",
          items: [],
        });
    } finally {
      request.done();
      this.busy = false;
      if (this.restartPending && this.timer) {
        this.restartPending = false;
        this.poll();
      }
    }
  }
}
module.exports = { GitHubWatcher, htmlUrl };
