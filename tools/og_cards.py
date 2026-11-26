"""Per-product link-preview cards (1200x630 JPG) for WhatsApp/Instagram/Facebook.
Reads src/data/catalog.json and public/products/<id>-0.webp, writes public/og/<id>.jpg.
Usage: python tools/og_cards.py"""
import json, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
PLUM, ROSE, MUTED = (58, 29, 43), (192, 61, 114), (106, 74, 88)
FR = os.path.join(ROOT, "node_modules/@fontsource/fraunces/files/fraunces-latin-600-normal.woff2")
DM = os.path.join(ROOT, "node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2")
TYPE = {"conjunto": "Conjunto", "top": "Top", "cropped": "Cropped", "macaquinho": "Macaquinho", "macacao": "Macacão"}

cat = json.load(open(os.path.join(ROOT, "src/data/catalog.json"), encoding="utf8"))["products"]
logo = Image.open(os.path.join(ROOT, "public/logo.png")).convert("RGBA")
logo = logo.resize((round(logo.width * 96 / logo.height), 96), Image.LANCZOS)
out = os.path.join(ROOT, "public/og"); os.makedirs(out, exist_ok=True)

def wrap(d, text, font, width):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= width: cur = t
        else: lines.append(cur); cur = w
    return lines + [cur]

for p in cat:
    im = Image.new("RGB", (W, H), (247, 240, 237))           # same cream as the product photos
    photo = Image.open(os.path.join(ROOT, f"public/products/{p['id']}-0.webp")).convert("RGB")
    ph = H; pw = round(photo.width * ph / photo.height)
    photo = photo.resize((pw, ph), Image.LANCZOS)
    im.paste(photo, (W - pw - 40, 0))
    d = ImageDraw.Draw(im)
    im.paste(logo, (70, 60), logo)
    f_name = ImageFont.truetype(FR, 54); f_meta = ImageFont.truetype(DM, 28)
    y = 210
    for line in wrap(d, p["name"], f_name, 1200 - pw - 40 - 140)[:3]:
        d.text((72, y), line, font=f_name, fill=PLUM); y += 66
    y += 14
    d.ellipse([74, y + 6, 96, y + 28], fill=p["hex"], outline=(0, 0, 0))
    d.text((110, y), p["color"], font=f_meta, fill=PLUM); y += 48
    d.text((74, y), "Peça pelo WhatsApp", font=f_meta, fill=ROSE)
    d.text((74, H - 70), "useallfit.vercel.app", font=ImageFont.truetype(DM, 24), fill=MUTED)
    im.save(os.path.join(out, f"{p['id']}.jpg"), quality=84, optimize=True, progressive=True)
print(len(cat), "cards")
