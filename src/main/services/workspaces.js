// Workspaces: one line per workspace in settings, "Name: item | item | item".
// An item is a web address, a folder/file path, or the name of an installed app.

function parse(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const i = line.search(/[:：]/);
      // a drive letter ("C:\...") is not a name separator
      if (i <= 0 || /^[a-z]:[\\/]/i.test(line)) return null;
      const name = line.slice(0, i).trim();
      const items = line
        .slice(i + 1)
        .split('|')
        .map((x) => x.trim())
        .filter(Boolean)
        .map(kind);
      return name && items.length ? { name, items } : null;
    })
    .filter(Boolean)
    .slice(0, 12);
}

function kind(value) {
  if (/^https?:\/\//i.test(value)) return { type: 'url', value };
  if (/^www\./i.test(value) || /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(value)) return { type: 'url', value: 'https://' + value };
  if (/^[a-z]:[\\/]/i.test(value) || value.startsWith('\\\\') || value.startsWith('/') || value.startsWith('~')) return { type: 'path', value };
  return { type: 'app', value };
}

module.exports = { parse, kind };
