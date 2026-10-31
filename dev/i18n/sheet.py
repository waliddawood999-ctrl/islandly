"""Contact sheets for T11: Arabic next to English for every captured state.
    python3 dev/i18n/sheet.py     (after node dev/i18n/shots.mjs)
-> dev/i18n/sheet-island-1.png, sheet-island-2.png, sheet-windows.png
"""
import json
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, 'shots')
shots = json.load(open(os.path.join(SHOTS, 'shots.json')))
font = ImageFont.load_default(size=22)
BG = (16, 17, 24)
INK = (200, 204, 222)


def load(name, lang, group):
    f = next(s['file'] for s in shots if s['name'] == name and s['lang'] == lang and s['group'] == group)
    return Image.open(os.path.join(SHOTS, f)).convert('RGB')


def sheet(rows, group, out, scale):
    pairs = [(name, load(name, 'ar', group), load(name, 'en', group)) for name in rows]
    w = max(int(a.width * scale) for _, a, _ in pairs)
    label_h, gap = 34, 14
    heights = [int(max(a.height, e.height) * scale) for _, a, e in pairs]
    total_h = 50 + sum(h + label_h + gap for h in heights)
    img = Image.new('RGB', (w * 2 + gap * 3, total_h), BG)
    d = ImageDraw.Draw(img)
    d.text((gap, 12), 'Arabic (ar)', fill=INK, font=font)
    d.text((gap * 2 + w, 12), 'English (en)', fill=INK, font=font)
    y = 50
    for (name, a, e), h in zip(pairs, heights):
        d.text((gap, y + 4), name, fill=(150, 156, 180), font=font)
        y += label_h
        for i, im in enumerate((a, e)):
            im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
            img.paste(im, (gap + i * (w + gap), y))
        y += h + gap
    img.save(os.path.join(HERE, out), optimize=True)
    print(out, img.size)


island = [s['name'] for s in shots if s['group'] == 'island' and s['lang'] == 'ar']
half = (len(island) + 1) // 2
sheet(island[:half], 'island', 'sheet-island-1.png', 0.5)
sheet(island[half:], 'island', 'sheet-island-2.png', 0.5)
sheet(['palette'], 'palette', 'sheet-palette.png', 0.5)
sheet(['settings'], 'settings', 'sheet-settings.png', 0.6)
