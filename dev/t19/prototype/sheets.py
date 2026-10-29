# Builds the contact sheets and GIFs in dev/t19/sheets from the frames written by dev/t19/prototype/shots.mjs.
#   python3 dev/t19/prototype/sheets.py
import glob, os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
o = os.path.join(here, 'out') + '/'
d = os.path.join(here, '..', 'sheets') + '/'
os.makedirs(d, exist_ok=True)

def load(f, crop=None, scale=0.4):
    i = Image.open(o + f).convert('RGB')
    if crop: i = i.crop(crop)
    return i.resize((int(i.width * scale), int(i.height * scale)), Image.LANCZOS)

def sheet(rows, out, gap=6):
    h = max(i.height for r in rows for i in r); w = max(i.width for r in rows for i in r); cols = max(len(r) for r in rows)
    S = Image.new('RGB', (w * cols + gap * (cols + 1), h * len(rows) + gap * (len(rows) + 1)), (30, 30, 38))
    for y, r in enumerate(rows):
        for x, i in enumerate(r): S.paste(i, (gap + x * (w + gap), gap + y * (h + gap)))
    S.save(d + out, optimize=True)

C = (0, 0, 1440, 520)
fr = ['t000', 't030', 't060', 't100', 't150', 't260']
for lang in ['ar', 'en']:
    rows = []
    for mode, mat in [('overlay', 'acrylic'), ('appbar', 'glass'), ('floating', 'acrylic')]:
        rows.append([load(f'B-{lang}-{mode}-center-{mat}-{t}.png', C) for t in fr])
        rows.append([load(f'B-{lang}-{mode}-center-{mat}-reverse-t30.png', C), load(f'B-{lang}-{mode}-center-{mat}-reverse-t90.png', C), load(f'B-{lang}-{mode}-center-{mat}-open.png', C)])
    sheet(rows, f'motion-B-{lang}.png')
sheet([[load(f'B-ar-floating-right-glass-t{t}.png', C) for t in ['060', '150', '260']], [load(f'B-en-floating-left-glass-t{t}.png', C) for t in ['060', '150', '260']], [load('B-motion-reduced-open.png', C), load('B-motion-off-open.png', C)]], 'motion-B-positions-reduced-off.png')
states = ['far-sleepy', 'near-left', 'near-right', 'near-below', 'blink', 'reduced-static', 'eco-hidden', 'fullscreen-hidden', 'motion-off-hidden']
for lang in ['ar', 'en']:
    rows = []
    for mode in ['overlay', 'appbar', 'floating']:
        for chunk in (states[:5], states[5:]):
            rows.append([load(f'C-{lang}-{mode}-acrylic-{s}.png', None, 0.45) for s in chunk])
    sheet(rows, f'motion-C-{lang}.png')
sheet([[load(f'C-{l}-{m}-glass-{s}.png', None, 0.45) for s in ['far-sleepy', 'near-left', 'blink']] for l in ['ar', 'en'] for m in ['overlay', 'appbar', 'floating']], 'motion-C-glass.png')
for g, name in [('B-ar-floating', 'motion-B-ar-floating'), ('B-en-overlay', 'motion-B-en-overlay'), ('B-en-appbar', 'motion-B-en-appbar'), ('B-ar-appbar', 'motion-B-ar-appbar'), ('C-eyes-en', 'motion-C-eyes-en')]:
    ims = [Image.open(f).convert('RGB') for f in sorted(glob.glob(o + f'gif/{g}-*.png'))]
    pal = ims[0].quantize(128, method=Image.MEDIANCUT)
    q = [i.quantize(palette=pal, dither=Image.NONE) for i in ims]
    q[0].save(d + name + '.gif', save_all=True, append_images=q[1:], duration=40, loop=0, optimize=True)
