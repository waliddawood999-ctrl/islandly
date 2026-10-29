const os = require('os');

function physicalRect(rect, zoom, dpi) {
  if (!rect || !['x', 'y', 'width', 'height', 'radius'].every((k) => Number.isFinite(rect[k])) ||
      rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 || rect.radius < 0 ||
      rect.x + rect.width > 10000 || rect.y + rect.height > 10000 ||
      !Number.isFinite(zoom) || zoom <= 0 || zoom > 5 || !Number.isFinite(dpi) || dpi <= 0 || dpi > 8) return null;
  const factor = zoom * dpi;
  return { x: Math.round(rect.x * factor), y: Math.round(rect.y * factor),
    width: Math.max(1, Math.round(rect.width * factor)), height: Math.max(1, Math.round(rect.height * factor)),
    radius: Math.round(Math.min(rect.radius, rect.width / 2, rect.height / 2) * factor) };
}

class Material {
  constructor({ window, native, zoom, dpi, publish, initialRect, platform = process.platform, release = os.release() }) {
    Object.assign(this, { window, native, zoom, dpi, publish });
    this.supported = platform === 'win32' && /^10\.0\./.test(release) && Number(release.split('.')[2]) >= 22000 &&
      typeof window.setBackgroundMaterial === 'function';
    this.effective = 'glass';
    this.requested = 'glass';
    this.last = initialRect || null;
    this.key = '';
  }
  state() { return { material: this.effective, supported: this.supported }; }
  region(rect, force = false) {
    const converted = physicalRect(rect, this.zoom(), this.dpi());
    if (!converted) return false;
    const key = JSON.stringify(converted);
    if (!force && key === this.key) return true;
    if (!this.native.setPillRegion(this.window.getNativeWindowHandle(), converted)) return false;
    this.key = key;
    return true;
  }
  fallback() {
    this.supported = false;
    this.effective = 'glass';
    this.key = '';
    try { this.window.setBackgroundMaterial('none'); } catch (_) { /* unsupported */ }
    this.native.setPillRegion(this.window.getNativeWindowHandle(), null);
  }
  apply(requested) {
    this.requested = requested;
    if (requested === 'acrylic' && this.supported) {
      // Do not blur the rectangular envelope before T6 supplies its first exact pill shape.
      if (!this.last) {
        this.effective = 'glass';
      } else {
        try {
          if (!this.region(this.last)) throw new Error('region unavailable');
          this.window.setBackgroundMaterial('acrylic');
          this.effective = 'acrylic';
        } catch (_) { this.fallback(); }
      }
    } else {
      try { if (this.window.setBackgroundMaterial) this.window.setBackgroundMaterial('none'); }
      catch (_) { this.supported = false; }
      this.native.setPillRegion(this.window.getNativeWindowHandle(), null);
      this.effective = 'glass';
      this.key = '';
    }
    this.publish(this.state());
  }
  shape(rect) {
    if (!physicalRect(rect, this.zoom(), this.dpi())) return;
    this.last = { ...rect };
    if (this.requested !== 'acrylic' || !this.supported) return;
    if (this.effective !== 'acrylic') this.apply(this.requested);
    else if (!this.region(this.last)) { this.fallback(); this.publish(this.state()); }
  }
  resized() {
    if (this.effective === 'acrylic' && this.last && !this.region(this.last, true)) {
      this.fallback(); this.publish(this.state());
    }
  }
}
module.exports = { Material, physicalRect };
