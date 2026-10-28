// GitHub notifications: polls the notifications API with the user's token (stored encrypted).
const { net } = require('electron');

const API = process.env.ISLANDLY_GH_API || 'https://api.github.com';

function request(token) {
  return new Promise((resolve, reject) => {
    const req = net.request({ url: API + '/notifications?per_page=20', method: 'GET' });
    req.setHeader('Authorization', 'Bearer ' + token);
    req.setHeader('Accept', 'application/vnd.github+json');
    req.setHeader('User-Agent', 'Islandly');
    req.setHeader('X-GitHub-Api-Version', '2022-11-28');
    let body = '';
    const timer = setTimeout(() => req.abort(), 15000);
    req.on('response', (res) => {
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        clearTimeout(timer);
        if (res.statusCode === 401) return reject(Object.assign(new Error('bad token'), { status: 401 }));
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.end();
  });
}

// The API returns API urls; turn them into the matching github.com page.
function htmlUrl(n) {
  const repo = n.repository && n.repository.html_url;
  const api = n.subject && n.subject.url;
  if (api) {
    const m = /\/repos\/([^/]+\/[^/]+)\/(pulls|issues)\/(\d+)/.exec(api);
    if (m) return `https://github.com/${m[1]}/${m[2] === 'pulls' ? 'pull' : 'issues'}/${m[3]}`;
  }
  return repo || 'https://github.com/notifications';
}

class GitHubWatcher {
  constructor(getToken, onChange) {
    this.getToken = getToken;
    this.onChange = onChange;
    this.timer = null;
    this.seen = new Set();
    this.first = true;
  }

  start() {
    this.stop();
    if (!this.getToken()) {
      this.onChange({ status: 'off', items: [] });
      return;
    }
    this.first = true;
    this.poll();
    this.timer = setInterval(() => this.poll(), 3 * 60 * 1000);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  async poll() {
    const token = this.getToken();
    if (!token) return this.stop();
    try {
      const list = await request(token);
      const items = (Array.isArray(list) ? list : []).map((n) => ({
        id: String(n.id),
        title: (n.subject && n.subject.title) || '',
        type: (n.subject && n.subject.type) || '',
        repo: (n.repository && n.repository.full_name) || '',
        reason: n.reason || '',
        url: htmlUrl(n),
      }));
      const fresh = this.first ? [] : items.filter((i) => !this.seen.has(i.id));
      items.forEach((i) => this.seen.add(i.id));
      this.first = false;
      this.onChange({ status: 'ok', items, fresh });
    } catch (err) {
      this.onChange({ status: err && err.status === 401 ? 'bad-token' : 'error', items: [] });
    }
  }
}

module.exports = { GitHubWatcher, htmlUrl };
