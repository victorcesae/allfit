"""Store link-preview card (public/og.jpg, 1200x630): logo, tagline, the two hero looks
(public/hero/look-1/2.webp, already scaled to the same height) in the blush arch.
Usage: python tools/og_store.py"""
import os
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
W, H = 1200, 630
PLUM, ROSE, MUTED, BLUSH = (58, 29, 43), (192, 61, 114), (106, 74, 88), (247, 166, 183)
FR = P("node_modules/@fontsource/fraunces/files/fraunces-latin-600-normal.woff2")
DM = P("node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2")
im = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(im)
for y in range(H):
    t = y / H; d.line([(0, y), (W, y)], fill=(253, int(246 - 13 * t), int(241 - 14 * t), 255))
arch = Image.new("RGBA", (W, H)); ad = ImageDraw.Draw(arch); ax, aw, top = 860, 430, 60
ad.rounded_rectangle([ax - aw // 2, top, ax + aw // 2, H + 200], radius=aw // 2, fill=BLUSH + (140,))
ad.rounded_rectangle([ax - aw // 2 + 16, top + 16, ax + aw // 2 - 16, H + 200], radius=aw // 2 - 16, outline=(255, 255, 255, 170), width=2)
im.alpha_composite(arch)
h = 600  # same height for both looks: their tops and hems line up
looks = [Image.open(P("public/hero", f"look-{i}.webp")).convert("RGBA") for i in (1, 2)]
looks = [lk.resize((round(lk.width * h / lk.height), h), Image.LANCZOS) for lk in looks]
gap = -30
x = ax - (looks[0].width + looks[1].width + gap) // 2
for lk in looks:
    im.alpha_composite(lk, (x, H - h)); x += lk.width + gap
logo = Image.open(P("public/logo.png")).convert("RGBA"); logo = logo.resize((round(logo.width * 150 / logo.height), 150), Image.LANCZOS)
im.alpha_composite(logo, (80, 70))
d = ImageDraw.Draw(im); fh = ImageFont.truetype(FR, 60); fb = ImageFont.truetype(DM, 27)
d.text((84, 262), "Sua melhor versão", font=fh, fill=PLUM)
d.text((84, 330), "começa ", font=fh, fill=PLUM); d.text((84 + d.textlength("começa ", font=fh), 330), "aqui.", font=fh, fill=ROSE)
d.text((86, 430), "Moda fitness feminina", font=fb, fill=MUTED)
d.text((86, 470), "5% de desconto no pagamento à vista", font=fb, fill=MUTED)
d.text((86, 510), "Peça pelo WhatsApp · useallfit.vercel.app", font=fb, fill=MUTED)
im.convert("RGB").save(P("public/og.jpg"), quality=86, optimize=True, progressive=True)
print("og.jpg", os.path.getsize(P("public/og.jpg")) // 1024, "KB")
