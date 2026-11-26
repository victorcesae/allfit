"""Remove mannequin nipple bumps by frequency separation.
Inside a feathered disk at each point: low frequencies are rebuilt from the surrounding ring
(normalized convolution, logo/print pixels excluded), the fine fabric grain is kept.
Usage: python retouch.py <framed_dir> <out_dir> <retouch_points.json>"""
import json, os, sys, shutil, glob
import numpy as np
from PIL import Image
from scipy import ndimage

src, out, cfg = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
os.makedirs(out, exist_ok=True)
for f in glob.glob(os.path.join(src, "*.png")):
    shutil.copy(f, out)

G = ndimage.gaussian_filter
for k, pts in cfg["points"].items():
    i = int(k); path = os.path.join(src, f"{i:02d}.png")
    im = np.asarray(Image.open(path).convert("RGBA")).astype(np.float64)
    rgb, alpha = im[..., :3], im[..., 3] > 200
    R = cfg.get("radius", {}).get(k, 40 if 12 <= i <= 33 else 28)
    lum = rgb.mean(-1)
    # print/logo pixels: far from the local median -> never used as fill source
    print_px = np.abs(lum - ndimage.median_filter(lum, size=31)) > 28
    hole = np.zeros(lum.shape, bool); yy, xx = np.mgrid[:lum.shape[0], :lum.shape[1]]
    for x, y in pts:
        hole |= (xx - x) ** 2 + (yy - y) ** 2 <= R ** 2
    W = (alpha & ~hole & ~ndimage.binary_dilation(print_px, iterations=4)).astype(float)
    sig = R * 0.75
    den = G(W, sig) + 1e-6
    fill = np.stack([G(rgb[..., c] * W, sig) / den for c in range(3)], -1)
    grain = np.clip(rgb - np.stack([G(rgb[..., c], 1.4) for c in range(3)], -1), -5, 5)  # fabric grain only, not the sharp tip
    new = fill + grain
    # feathered blend weight: 1 inside 0.65R, smooth to 0 at R; never touch print pixels
    wgt = np.zeros(lum.shape)
    for x, y in pts:
        d = np.sqrt((xx - x) ** 2 + (yy - y) ** 2) / R
        t = np.clip((1 - d) / 0.35, 0, 1); wgt = np.maximum(wgt, t * t * (3 - 2 * t))
    wgt[print_px | ~alpha] = 0
    rgb2 = rgb * (1 - wgt[..., None]) + new * wgt[..., None]
    im[..., :3] = np.clip(rgb2, 0, 255)
    Image.fromarray(im.astype(np.uint8), "RGBA").save(os.path.join(out, f"{i:02d}.png"))
    print(k, "R", R, "points", len(pts))
