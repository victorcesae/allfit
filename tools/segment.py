"""Cut garments out of mannequin photos -> transparent PNGs.
Usage: python segment.py <looks_dir> <out_dir> [index ...]
Uses mattmdjaga/segformer_b2_clothes (ATR labels)."""
import os, sys, glob
import numpy as np, torch
from PIL import Image, ImageOps, ImageFilter
from scipy import ndimage
from transformers import SegformerImageProcessor, AutoModelForSemanticSegmentation

# ATR labels: 0 bg,1 hat,2 hair,3 sunglasses,4 upper,5 skirt,6 pants,7 dress,8 belt,
# 9 l-shoe,10 r-shoe,11 face,12 l-leg,13 r-leg,14 l-arm,15 r-arm,16 bag,17 scarf
CLOTH = [4, 5, 6, 7, 8, 17]
TOP_ONLY = set(range(12, 34))          # photos showing just a top: drop the leggings below
# photos where bits of the gold mannequin leak in; garment hue is far from gold so filter by colour
DESKIN = {5, 12, 19, 30, 40, 43, 52}
DARK_ONLY = {51}                       # dark garment: drop bright mannequin reflections
# strappy back views the model can't follow: keep pixels matching the garment colour
# (taken from the matching front photo) anywhere on the mannequin
COLOR_MATCH = {14: 15, 23: 22, 24: 29, 27: 28, 31: 32}
MATCH_TUNE = {24: (26, 4), 31: (34, 14)}   # (colour tolerance, gap closing)
ROW_FILL = {31}                        # solid band with a tag in front: fill each wide row edge to edge
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
files = sorted(glob.glob(os.path.join(src, "*.jpeg")))
idx = [int(a) for a in sys.argv[3:]] or range(len(files))
proc = SegformerImageProcessor.from_pretrained("mattmdjaga/segformer_b2_clothes")
model = AutoModelForSemanticSegmentation.from_pretrained("mattmdjaga/segformer_b2_clothes").eval()

def crop_letterbox(im):
    # WhatsApp portrait shots have black bars top/bottom
    a = np.asarray(im.convert("L"))
    rows = np.where(a.mean(1) > 12)[0]
    return im.crop((0, rows[0], im.width, rows[-1] + 1)) if len(rows) else im

def run(im):
    with torch.no_grad():
        logits = model(**proc(images=im, return_tensors="pt")).logits
    up = torch.nn.functional.interpolate(logits, size=im.size[::-1], mode="bilinear", align_corners=False)
    return up.argmax(1)[0].numpy()

def load(i):
    im = crop_letterbox(ImageOps.exif_transpose(Image.open(files[i])).convert("RGB"))
    if max(im.size) > 1600:
        im.thumbnail((1600, 1600))
    return im

def garment_color(j):
    im = load(j); seg = run(im)
    m = ndimage.binary_erosion(np.isin(seg, [4, 7]), iterations=8)
    return np.median(np.asarray(im.convert("LAB")).astype(float)[m], axis=0)

for i in idx:
    im = load(i)
    seg = run(im)
    mask = np.isin(seg, [4, 7, 17] if i in TOP_ONLY else CLOTH)
    if i in DESKIN:
        hsv = np.asarray(im.convert("HSV")).astype(float)
        h, sat, val = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
        gold = (h > 15) & (h < 60) & (sat > 0.12) & (val > 0.25)
        mask &= ~ndimage.binary_dilation(gold, iterations=2)
    if i in DARK_ONLY:
        mask &= np.asarray(im.convert("L")) < 110
    if i in COLOR_MATCH:
        ref = garment_color(COLOR_MATCH[i])
        lab_im = np.asarray(im.convert("LAB")).astype(float)
        dist = np.sqrt(((lab_im[..., 1:] - ref[1:]) ** 2).sum(-1) + 0.25 * (lab_im[..., 0] - ref[0]) ** 2)
        figure = ndimage.binary_dilation(seg > 0, iterations=15)
        tol, close = MATCH_TUNE.get(i, (22, 2))
        mask = (dist < tol) & figure
        mask = ndimage.binary_closing(mask, iterations=close)
    if i in ROW_FILL:
        cols = np.where(mask.any(0))[0]; full = cols[-1] - cols[0]
        for r in np.where(mask.any(1))[0]:
            xs = np.where(mask[r])[0]
            if xs[-1] - xs[0] > 0.6 * full and len(xs) > 0.55 * (xs[-1] - xs[0]):
                mask[r, xs[0]:xs[-1] + 1] = True
    # keep large components only, fill holes
    lab, n = ndimage.label(mask)
    if n:
        sizes = ndimage.sum(mask, lab, range(1, n + 1))
        keep = [k + 1 for k, s in enumerate(sizes) if s > 0.08 * sizes.max()]
        mask = np.isin(lab, keep)
    mask = ndimage.binary_opening(mask, iterations=2)
    alpha = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    rgba = im.copy(); rgba.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 20 else 0).getbbox()
    if bbox:
        pad = 20
        rgba = rgba.crop((max(0, bbox[0]-pad), max(0, bbox[1]-pad), min(im.width, bbox[2]+pad), min(im.height, bbox[3]+pad)))
    rgba.save(os.path.join(out, f"{i:02d}.png"))
    print(i, "ok", rgba.size, flush=True)
