const fs = require('fs');
const path = require('path');
const { app, nativeImage } = require('electron');

/** A temporary holding area for files. Only paths are stored; the files themselves are never copied or moved. */
class Shelf {
  constructor(onChange) {
    this.onChange = onChange;
    this.items = [];
    this.file = '';
    this.seq = 1;
    this.fallbackIcon = nativeImage.createEmpty();
  }

  load() {
    this.file = path.join(app.getPath('userData'), 'shelf.json');
    try {
      const paths = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.items = paths.filter((p) => fs.existsSync(p)).map((p) => this.makeItem(p));
    } catch (_) {
      /* empty shelf */
    }
    this.items.forEach((item) => this.loadIcon(item));
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.items.map((i) => i.path)));
    } catch (_) {
      /* non-fatal */
    }
  }

  makeItem(p) {
    let isDir = false;
    try {
      isDir = fs.statSync(p).isDirectory();
    } catch (_) {
      /* missing */
    }
    return { id: this.seq++, path: p, name: path.basename(p) || p, isDir, icon: null };
  }

  async loadIcon(item) {
    try {
      const img = await app.getFileIcon(item.path, { size: 'normal' });
      item.icon = img.toDataURL();
      this.emit();
    } catch (_) {
      /* keep the generic icon */
    }
  }

  list() {
    return this.items.map(({ id, path: p, name, isDir, icon }) => ({ id, path: p, name, isDir, icon }));
  }

  emit() {
    this.onChange(this.list());
  }

  add(paths) {
    let added = 0;
    for (const p of paths) {
      if (!p || this.items.some((i) => i.path === p)) continue;
      const item = this.makeItem(p);
      this.items.push(item);
      this.loadIcon(item);
      added++;
    }
    if (added) {
      this.save();
      this.emit();
    }
    return added;
  }

  remove(ids) {
    const drop = new Set(ids);
    this.items = this.items.filter((i) => !drop.has(i.id));
    this.save();
    this.emit();
  }

  clear() {
    this.items = [];
    this.save();
    this.emit();
  }

  pathsFor(ids) {
    return this.items.filter((i) => ids.includes(i.id)).map((i) => i.path);
  }

  iconFor(p) {
    const item = this.items.find((i) => i.path === p);
    return item && item.icon ? nativeImage.createFromDataURL(item.icon) : this.fallbackIcon;
  }
}

module.exports = { Shelf };
