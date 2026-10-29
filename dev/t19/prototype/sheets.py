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
# ---- C: gaze boards (cursor left, right, below-left, below-right, directly below, + above-right, far cases), states, timelines
from PIL import ImageDraw
def label(img, text):
    out = Image.new('RGB', (img.width, img.height + 22), (24, 25, 34))
    out.paste(img, (0, 0))
    ImageDraw.Draw(out).text((8, img.height + 6), text, fill=(205, 210, 230))
    return out
names = [('left', 'cursor left'), ('right', 'cursor right'), ('below-left', 'below-left'), ('below-right', 'below-right'), ('below', 'directly below')]
extra = [('far-below-left', 'far below-left: sleepy lids, same angle'), ('far-right', 'far right: sleepy lids, same angle')]
def pad(im, h):
    c = Image.new('RGB', (im.width, h), (24, 25, 34)); c.paste(im, (0, 0)); return c
def gaze_sheet(mode, items, out, scale=0.62):
    rows = []
    for theme in ['dark', 'light']:
        for lang in ['en', 'ar']:
            rows.append([label(load(f'C-gaze-{theme}-{lang}-{mode}-gaze-{n}.png', None, scale), f'{theme} {lang.upper()} - {t}') for n, t in items])
    h = max(i.height for r in rows for i in r)
    sheet([[pad(i, h) for i in r] for r in rows], out)
for mode in ['overlay', 'appbar', 'floating']:
    gaze_sheet(mode, names, f'motion-C-gaze-{mode}.png')
    gaze_sheet(mode, extra, f'motion-C-gaze-{mode}-far.png', 0.9)
sts = ['rest-awake', 'blink', 'sleepy-far', 'squint', 'reduced-static', 'eco-hidden', 'fullscreen-hidden', 'motion-off-hidden']
sheet([[label(load(f'C-{t}-{l}-{s}.png', None, 0.5), f'{t} {l.upper()} · {s}') for s in sts] for t in ['dark', 'light'] for l in ['en', 'ar']], 'motion-C-states.png')
sheet([[label(load(f'C-blink-t{t:03d}.png', None, 0.5), f'blink t={t} ms') for t in [0, 56, 112, 134, 190, 280]], [label(load(f'C-sleep-t{t:04d}.png', None, 0.5), f'falling asleep t={t} ms') for t in [0, 80, 160, 300, 500, 1200]]], 'motion-C-timelines.png')
for g, name in [('B-ar-floating', 'motion-B-ar-floating'), ('B-en-overlay', 'motion-B-en-overlay'), ('B-en-appbar', 'motion-B-en-appbar'), ('B-ar-appbar', 'motion-B-ar-appbar'), ('C-eyes-dark-en', 'motion-C-eyes-dark-en'), ('C-eyes-light-ar', 'motion-C-eyes-light-ar')]:
    ims = [Image.open(f).convert('RGB') for f in sorted(glob.glob(o + f'gif/{g}-*.png'))]
    pal = ims[0].quantize(128, method=Image.MEDIANCUT)
    q = [i.quantize(palette=pal, dither=Image.NONE) for i in ims]
    q[0].save(d + name + '.gif', save_all=True, append_images=q[1:], duration=40, loop=0, optimize=True)
