"""Give empty hanging sleeves (armless mannequins) the light of a filled, rounded arm.

Inside each sleeve box, every row's sleeve span gets cylindrical shading: darker toward both
edges, a soft highlight slightly off-centre. Only the photo's own pixels are re-lit, nothing is
painted in. Boxes are in the 1080x1350 framed space (frame.py output).
Usage: python sleeve_volume.py <framed_dir> <out_dir> [photo ...]"""
import os, sys, shutil
import numpy as np
from PIL import Image

SLEEVES = {  # photo -> boxes (x0, y0, x1, y1, side): side L/R = sleeve is the outermost span on that side
    16: [(140, 500, 272, 1140, "L"), (800, 500, 935, 1140, "R")],   # p10 pink long-sleeve cropped
    47: [(340, 300, 440, 640, "L")],                           # p31 teal one-sleeve set
    49: [(325, 280, 418, 715, "L"), (652, 280, 750, 715, "R")],     # p33 navy long-sleeve set
}

src, out = sys.argv[1], sys.argv[2]
only = [int(a) for a in sys.argv[3:]] or list(SLEEVES)
os.makedirs(out, exist_ok=True)

for i in only:
    path = os.path.join(src, f"{i:02d}.png")
    im = np.asarray(Image.open(path).convert("RGBA")).astype(np.float64)
    rgb, a = im[..., :3], im[..., 3]
    for x0, y0, x1, y1, side in SLEEVES[i]:
        widths = []  # recent sleeve widths: a span much wider than these has merged with the body/leggings
        for y in range(y0, y1):
            ramp = min(1.0, (y - y0) / 40.0)                      # fade in under the shoulder
            row = a[y, x0:x1] > 160
            xs = np.where(row)[0]
            if len(xs) < 8:
                continue
            # sleeve = the widest run of opaque pixels in this row
            runs, start = [], xs[0]
            for p, q in zip(xs, xs[1:]):
                if q != p + 1:
                    runs.append((start, p)); start = q
            runs.append((start, xs[-1]))
            s, e = runs[0] if side == "L" else runs[-1]   # outermost span = the sleeve, never the body/leggings
            w = e - s + 1
            if widths:
                ref = int(np.median(widths[-25:]))
                if w > ref * 1.35:                       # merged: keep only the outer sleeve-width part
                    if side == "L": e = s + ref - 1
                    else: s = e - ref + 1
                    w = ref
                else:
                    widths.append(w)
            else:
                widths.append(w)
            if w < 8:
                continue
            t = (np.arange(w) + 0.5) / w
            shade = 1 - 0.42 * np.abs(2 * t - 1) ** 2.0                # edges fall off
            hi = np.exp(-(((t - 0.4) / 0.16) ** 2))                   # soft highlight
            seg = rgb[y, x0 + s:x0 + e + 1]
            lum = seg.mean(-1, keepdims=True)
            lit = seg * (shade[:, None] + 0.10 * hi[:, None]) + (24 * hi[:, None]) * (1 - lum / 255)
            rgb[y, x0 + s:x0 + e + 1] = seg * (1 - ramp) + lit * ramp
    im[..., :3] = np.clip(rgb, 0, 255)
    Image.fromarray(im.astype(np.uint8), "RGBA").save(os.path.join(out, f"{i:02d}.png"))
    print(i, "sleeves", len(SLEEVES[i]))
