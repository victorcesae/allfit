"""Place each matte on a uniform 1080x1350 transparent frame (for PhotoCraft finishing).
Keeps the soft matte edge (no erosion) and resamples with Lanczos on premultiplied colour,
so edges stay smooth instead of pixelated / haloed.
Usage: python frame.py <in_dir> <out_dir> [fill=0.88]"""
import os, sys, glob
import numpy as np
from PIL import Image
from scipy import ndimage

W, H = 1080, 1350
src, out = sys.argv[1], sys.argv[2]
FILL = float(sys.argv[3]) if len(sys.argv) > 3 else 0.88
os.makedirs(out, exist_ok=True)


def resize_premult(im, size):
    a = np.asarray(im).astype(np.float32) / 255
    a[..., :3] *= a[..., 3:4]                      # premultiply: no dark/bright fringes
    chans = [Image.fromarray(a[..., c]).resize(size, Image.LANCZOS) for c in range(4)]
    r = np.stack([np.asarray(c) for c in chans], -1)
    al = np.clip(r[..., 3:4], 1e-4, 1)
    r[..., :3] = np.where(r[..., 3:4] > 1e-3, r[..., :3] / al, 0)
    return Image.fromarray((np.clip(r, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


for f in sorted(glob.glob(os.path.join(src, "*.png"))):
    im = Image.open(f).convert("RGBA")
    # drop small detached fragments (leftover bits of legging / background)
    arr = np.asarray(im).copy(); m = arr[..., 3] > 30
    lab, n = ndimage.label(m)
    if n > 1:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        drop = np.isin(lab, [k + 1 for k, s in enumerate(sizes) if s < 0.03 * sizes.max()])
        arr[..., 3][ndimage.binary_dilation(drop, iterations=2)] = 0
        im = Image.fromarray(arr, "RGBA")
    a = im.getchannel("A")
    im = im.crop(a.point(lambda v: 255 if v > 12 else 0).getbbox())
    s = min(W * FILL / im.width, H * FILL / im.height)
    im = resize_premult(im, (round(im.width * s), round(im.height * s)))
    c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    c.alpha_composite(im, ((W - im.width) // 2, (H - im.height) // 2 + 8))
    c.save(os.path.join(out, os.path.basename(f)))
