"""Remove mannequin nipple bumps on the mannequin-kept mattes (matte.py output).
Points in retouch_points.json are in the 1080x1350 garment-frame space (frame.py applied to the
segment.py cutouts); they are mapped back to original-photo pixels, then healed by frequency
separation: low frequencies rebuilt from the surrounding ring of GARMENT pixels (the garment mask
comes from the segment.py cutout), fine fabric grain kept.
Usage: python retouch_orig.py <matte_dir> <cutout_dir> <points.json> <out_dir>"""
import json, os, sys, shutil, glob
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

matte_dir, cut_dir, cfg_path, out = sys.argv[1:5]
cfg = json.load(open(cfg_path))
os.makedirs(out, exist_ok=True)
for f in glob.glob(os.path.join(matte_dir, "*.png")):
    shutil.copy(f, out)
W, H, FILL = 1080, 1350, 0.82
G = ndimage.gaussian_filter


def frame_params(cut):
    """Same maths as frame.py: returns (bbox_x0, bbox_y0, scale, paste_x, paste_y)."""
    a = cut.getchannel("A").point(lambda v: 0 if v < 24 else v).filter(ImageFilter.MinFilter(3))
    b = a.getbbox(); w, h = b[2] - b[0], b[3] - b[1]
    s = min(W * FILL / w, H * FILL / h)
    return b[0], b[1], s, (W - round(w * s)) // 2, (H - round(h * s)) // 2 - 10


def find_offset(big, cut):
    """Cutouts are exact crops of the photo: locate one by exact pixel match."""
    B = np.asarray(big.convert("RGB")).astype(np.int16)
    C = np.asarray(cut.convert("RGBA")).astype(np.int16)
    ys, xs = np.where(C[..., 3] == 255)
    k = len(ys) // 2; py, px = ys[k], xs[k]
    probe = C[py, px, :3]
    cand = np.argwhere((B == probe).all(-1))
    pts = [(ys[j], xs[j]) for j in np.linspace(0, len(ys) - 1, 40).astype(int)]
    for cy, cx in cand:
        oy, ox = cy - py, cx - px
        if all(0 <= y + oy < B.shape[0] and 0 <= x + ox < B.shape[1] and (B[y + oy, x + ox] == C[y, x, :3]).all() for y, x in pts):
            return ox, oy
    raise RuntimeError("cutout not found in photo")


for k, pts in cfg["points"].items():
    i = int(k)
    big = Image.open(os.path.join(matte_dir, f"{i:02d}.png")).convert("RGBA")
    cut = Image.open(os.path.join(cut_dir, f"{i:02d}.png")).convert("RGBA")
    ox, oy = find_offset(big, cut)
    bx, by, s, px, py = frame_params(cut)
    to_orig = lambda fx, fy: ((fx - px) / s + bx + ox, (fy - py) / s + by + oy)
    R = cfg.get("radius", {}).get(k, 40 if 12 <= i <= 33 else 28) / s

    im = np.asarray(big).astype(np.float64)
    rgb = im[..., :3]
    garment = np.zeros(rgb.shape[:2], bool)
    ca = np.asarray(cut.getchannel("A")) > 200
    garment[oy:oy + ca.shape[0], ox:ox + ca.shape[1]] = ca
    lum = rgb.mean(-1)
    print_px = np.abs(lum - ndimage.median_filter(lum, size=int(31 / s) | 1)) > 28
    # only real prints (logo letters) are protected; tiny dark specks = the nipple tip itself
    lab, n = ndimage.label(print_px)
    if n:
        sizes = ndimage.sum(print_px, lab, range(1, n + 1))
        print_px = np.isin(lab, [j + 1 for j, z in enumerate(sizes) if z >= 90 / (s * s)])
    yy, xx = np.mgrid[:lum.shape[0], :lum.shape[1]]
    centers = [to_orig(*p) for p in pts]
    hole = np.zeros(lum.shape, bool)
    for x, y in centers:
        hole |= (xx - x) ** 2 + (yy - y) ** 2 <= R ** 2
    Wt = (garment & ~hole & ~ndimage.binary_dilation(print_px, iterations=4)).astype(float)
    sig = R * 0.75
    den = G(Wt, sig) + 1e-6
    fill = np.stack([G(rgb[..., c] * Wt, sig) / den for c in range(3)], -1)
    grain = np.clip(rgb - np.stack([G(rgb[..., c], 1.4 / s) for c in range(3)], -1), -5, 5)
    wgt = np.zeros(lum.shape)
    for x, y in centers:
        d = np.sqrt((xx - x) ** 2 + (yy - y) ** 2) / R
        t = np.clip((1 - d) / 0.35, 0, 1)
        wgt = np.maximum(wgt, t * t * (3 - 2 * t))
    wgt[print_px | ~garment] = 0
    im[..., :3] = np.clip(rgb * (1 - wgt[..., None]) + (fill + grain) * wgt[..., None], 0, 255)
    Image.fromarray(im.astype(np.uint8), "RGBA").save(os.path.join(out, f"{i:02d}.png"))
    print(k, "offset", (ox, oy), "scale %.3f" % s, "R %.0f" % R)
