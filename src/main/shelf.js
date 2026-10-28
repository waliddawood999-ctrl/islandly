const fs = require('fs');
const path = require('path');
const { app, nativeImage } = require('electron');

const IMAGE = /\.(png|jpe?g|bmp)$/i;

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
    return { id: this.seq++, path: p, name: path.basename(p) || p, isDir, isImage: !isDir && IMAGE.test(p), icon: null };
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
    return this.items.map(({ id, path: p, name, isDir, isImage, icon }) => ({ id, path: p, name, isDir, isImage, icon }));
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

  /**
   * Image quick actions: 'png' / 'jpg' convert, 'half' halves the size. The result is written next to the original
   * (or to Downloads if that folder is read-only) and added to the shelf. Returns the new path or null.
   */
  imageOp(id, op) {
    const item = this.items.find((i) => i.id === id);
    if (!item || !item.isImage || !['png', 'jpg', 'half'].includes(op)) return null;
    let img = nativeImage.createFromPath(item.path);
    if (img.isEmpty()) return null;
    const ext = path.extname(item.path);
    const base = path.basename(item.path, ext);
    let outExt = op === 'jpg' ? '.jpg' : op === 'png' ? '.png' : /\.jpe?g$/i.test(ext) ? '.jpg' : '.png';
    if (op === 'half') {
      const { width, height } = img.getSize();
      img = img.resize({ width: Math.max(1, Math.round(width / 2)), height: Math.max(1, Math.round(height / 2)), quality: 'best' });
    }
    const data = outExt === '.jpg' ? img.toJPEG(90) : img.toPNG();
    const name = op === 'half' ? `${base}-50%${outExt}` : `${base}${outExt}`;
    for (const dir of [path.dirname(item.path), app.getPath('downloads')]) {
      let target = path.join(dir, name);
      for (let n = 2; fs.existsSync(target); n++) target = path.join(dir, name.replace(outExt, ` (${n})${outExt}`));
      try {
        fs.writeFileSync(target, data);
        this.add([target]);
        return target;
      } catch (_) {
        /* try the next folder */
      }
    }
    return null;
  }

  iconFor(p) {
    const item = this.items.find((i) => i.path === p);
    return item && item.icon ? nativeImage.createFromDataURL(item.icon) : this.fallbackIcon;
  }
}

module.exports = { Shelf };
