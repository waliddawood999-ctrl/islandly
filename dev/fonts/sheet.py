# Composes dev/fonts/compare/*.png into one labelled sheet (rows: pairing x language, columns: states).
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
here = os.path.dirname(os.path.abspath(__file__))
d = os.path.join(here, 'compare')
shots = json.load(open(os.path.join(d, 'shots.json')))
states = ['compact', 'mini', 'player']
rows = []
for s in shots:
    key = (s['id'], s['lang'])
    if key not in [r[0] for r in rows]: rows.append((key, s['label']))
cw, ch, lw, top = 560, 230, 230, 34
sheet = Image.new('RGB', (lw + cw * len(states), top + ch * len(rows)), (18, 18, 24))
draw = ImageDraw.Draw(sheet)
font_path = os.path.join(here, '..', '..', 'node_modules', '@fontsource', 'ibm-plex-sans', 'files')
try:
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
except Exception:
    f = ImageFont.load_default()
for i, name in enumerate(['resting pill', 'mini player', 'big player']):
    draw.text((lw + i * cw + 12, 9), name, fill=(200, 200, 210), font=f)
for r, ((pid, lang), label) in enumerate(rows):
    y = top + r * ch
    draw.text((12, y + 14), pid + ' / ' + lang, fill=(255, 255, 255), font=f)
    for k, part in enumerate(label.split(' + ')):
        draw.text((12, y + 40 + k * 20), part, fill=(160, 160, 175), font=f)
    for c, st in enumerate(states):
        im = Image.open(os.path.join(d, f'{pid}-{lang}-{st}.png')).resize((cw, ch), Image.LANCZOS)
        sheet.paste(im, (lw + c * cw, y))
    draw.line([(0, y), (sheet.width, y)], fill=(50, 50, 60))
out = os.path.join(d, 'compare-sheet.png')
sheet.save(out)
print(out, sheet.size)

# a 2x close-up of the mini player per pairing and language (typography detail)
crops = []
for (pid, lang), label in rows:
    im = Image.open(os.path.join(d, f'{pid}-{lang}-mini.png'))
    crops.append(((pid, lang, label), im.crop((150, 10, 970, 160))))
zw, zh = crops[0][1].size
zoom = Image.new('RGB', (lw + zw, zh * len(crops)), (18, 18, 24))
dz = ImageDraw.Draw(zoom)
for i, ((pid, lang, label), im) in enumerate(crops):
    zoom.paste(im, (lw, i * zh))
    dz.text((12, i * zh + 30), pid + ' / ' + lang, fill=(255, 255, 255), font=f)
    for k, part in enumerate(label.split(' + ')):
        dz.text((12, i * zh + 56 + k * 20), part, fill=(160, 160, 175), font=f)
zoom.save(os.path.join(d, 'compare-zoom.png'))
print('zoom', zoom.size)
