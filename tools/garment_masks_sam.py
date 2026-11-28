"""Garment masks for the colour preview, v2: SegFormer finds the garments, SAM 2 cuts them out,
ViTMatte gives the edges real soft alpha. Writes public/masks/<id>-<n>.png (half size, grayscale;
white = fabric that gets recoloured, black = mannequin, tags, backdrop), aligned pixel-for-pixel
with public/products/<id>-<n>.webp.

No colour-based growing: that is what made the old masks leak onto the gold mannequin.

Hard photos are fixed by hand in tools/mask_points.json (coordinates in the 1080x1350 photo):
  "p11-1": {"add": [[x, y], ...],      # fabric SAM missed (each point joins the nearest garment)
            "remove": [[x, y], ...],   # mannequin / tag / leg SAM took
            "boxes": [[x0, y0, x1, y1]]}  # optional: replaces the automatic garments entirely

Usage: python tools/garment_masks_sam.py [--out DIR] [--debug DIR] [id-n ...]
"""
import argparse, glob, json, os
import numpy as np, torch
from PIL import Image
from scipy import ndimage
from transformers import (SegformerImageProcessor, AutoModelForSemanticSegmentation,
                          Sam2Processor, Sam2Model, VitMatteImageProcessor, VitMatteForImageMatting)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--out", default=os.path.join(ROOT, "public/masks"))
ap.add_argument("--debug", help="also write full-size masks + prompt overlays here")
ap.add_argument("keys", nargs="*", help="photo keys like p11-1 (default: all)")
args = ap.parse_args()
os.makedirs(args.out, exist_ok=True)
if args.debug: os.makedirs(args.debug, exist_ok=True)

points_file = os.path.join(ROOT, "tools/mask_points.json")
manual = json.load(open(points_file, encoding="utf8")) if os.path.exists(points_file) else {}

torch.set_grad_enabled(False)
seg_proc = SegformerImageProcessor.from_pretrained("mattmdjaga/segformer_b2_clothes")
seg_model = AutoModelForSemanticSegmentation.from_pretrained("mattmdjaga/segformer_b2_clothes").eval()
sam_proc = Sam2Processor.from_pretrained("facebook/sam2.1-hiera-large")
sam_model = Sam2Model.from_pretrained("facebook/sam2.1-hiera-large").eval()
mat_proc = VitMatteImageProcessor.from_pretrained("hustvl/vitmatte-base-composition-1k")
mat_model = VitMatteForImageMatting.from_pretrained("hustvl/vitmatte-base-composition-1k").eval()

GARMENT = [4, 5, 6, 7, 8, 17]  # ATR: upper clothes, skirt, pants, dress, belt, scarf
BODY = [11, 12, 13, 14, 15, 9, 10]  # face, legs, arms, shoes: on our photos that is the mannequin


def segformer(im):
    lg = seg_model(**seg_proc(images=im, return_tensors="pt")).logits
    return torch.nn.functional.interpolate(lg, size=im.size[::-1], mode="bilinear").argmax(1)[0].numpy()


def backdrop(rgb):
    """The studio backdrop: everything connected to the image border that is light and unsaturated."""
    f = rgb.astype(int)
    mx, mn = f.max(-1), f.min(-1)
    light = (mx > 200) & (mx - mn < 40)
    lab, _ = ndimage.label(light)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    return np.isin(lab, edge[edge > 0])


def core_points(m, n):
    """n positive points spread over the thick part of a component (distance-transform maxima)."""
    dt = ndimage.distance_transform_edt(m)
    pts = []
    for _ in range(n):
        y, x = np.unravel_index(dt.argmax(), dt.shape)
        if dt[y, x] < 4: break
        pts.append([int(x), int(y)])
        yy, xx = np.ogrid[:m.shape[0], :m.shape[1]]
        dt[(yy - y) ** 2 + (xx - x) ** 2 < (max(dt[y, x], 20) * 2.2) ** 2] = 0
    return pts


def far_points(m, n, rng):
    """n negative points well inside a region (never near its border)."""
    inner = ndimage.binary_erosion(m, iterations=12)
    ys, xs = np.nonzero(inner)
    if not len(ys): return []
    pick = rng.choice(len(ys), size=min(n, len(ys)), replace=False)
    return [[int(xs[i]), int(ys[i])] for i in pick]


def sam(im, box, pos, neg):
    pts = pos + neg
    box = [int(v) for v in box]
    kw = dict(images=im, input_boxes=[[box]], return_tensors="pt")
    if pts:
        kw["input_points"] = [[pts]]
        kw["input_labels"] = [[[1] * len(pos) + [0] * len(neg)]]
    inp = sam_proc(**kw)
    out = sam_model(**inp, multimask_output=True)
    masks = sam_proc.post_process_masks(out.pred_masks.cpu(), inp["original_sizes"])[0][0].numpy() > 0
    return masks, out.iou_scores[0, 0].numpy()


def best(masks, scores, coarse, neg):
    """Pick the candidate that covers the coarse garment, stays off the negatives, scores well."""
    def cost(i):
        m = masks[i]
        cover = (m & coarse).sum() / max(coarse.sum(), 1)
        bad = sum(m[y, x] for x, y in neg) if neg else 0
        return cover + 0.3 * scores[i] - 0.5 * bad
    return masks[max(range(len(masks)), key=cost)]


def matte(im, hard):
    """Soft alpha with ViTMatte in a thin band around the hard SAM edge."""
    fg = ndimage.binary_erosion(hard, iterations=3)
    unknown = ndimage.binary_dilation(hard, iterations=3) & ~fg
    tri = np.where(fg, 255, np.where(unknown, 128, 0)).astype(np.uint8)
    inp = mat_proc(images=im, trimaps=Image.fromarray(tri), return_tensors="pt")
    a = mat_model(**inp).alphas[0, 0].numpy()[: im.height, : im.width]
    a = np.where(fg, 1.0, np.where(unknown, a, 0.0))
    return (a * 255 + 0.5).astype(np.uint8)


def process(key):
    im = Image.open(os.path.join(ROOT, "public/products", key + ".webp")).convert("RGB")
    rgb = np.asarray(im)
    rng = np.random.default_rng(0)
    seg = segformer(im)
    bg = backdrop(rgb)
    coarse = np.isin(seg, GARMENT) & ~bg
    coarse = ndimage.binary_opening(coarse, iterations=2)
    mannequin = (np.isin(seg, BODY) | (seg == 0)) & ~bg & ~ndimage.binary_dilation(coarse, iterations=10)
    fix = manual.get(key, {})
    add, remove = fix.get("add", []), fix.get("remove", [])
    neg_auto = far_points(mannequin, 6, rng)

    objects = []  # (box, pos, neg, coarse_part)
    if fix.get("boxes"):
        for b in fix["boxes"]:
            part = np.zeros_like(coarse); part[b[1]:b[3], b[0]:b[2]] = coarse[b[1]:b[3], b[0]:b[2]]
            objects.append([list(b), core_points(part, 3), [], part])
    else:
        lab, k = ndimage.label(coarse)
        sizes = ndimage.sum(coarse, lab, range(1, k + 1)) if k else []
        for j, s in enumerate(sizes):
            if s < 0.02 * max(sizes): continue
            part = lab == j + 1
            ys, xs = np.nonzero(part)
            pad = 12
            box = [max(0, xs.min() - pad), max(0, ys.min() - pad),
                   min(im.width - 1, xs.max() + pad), min(im.height - 1, ys.max() + pad)]
            objects.append([box, core_points(part, 3), [], part])
    # hand-added fabric joins the nearest garment and widens its box to reach it
    for x, y in add:
        if not objects: break
        d = [ndimage.distance_transform_edt(~o[3])[y, x] for o in objects]
        o = objects[int(np.argmin(d))]
        o[1].append([x, y])
        o[0] = [min(o[0][0], x - 8), min(o[0][1], y - 8), max(o[0][2], x + 8), max(o[0][3], y + 8)]
    hard = np.zeros(coarse.shape, bool)
    for box, pos, _, part in objects:
        neg = [p for p in neg_auto + remove if box[0] <= p[0] <= box[2] and box[1] <= p[1] <= box[3]]
        masks, scores = sam(im, box, pos, neg)
        hard |= best(masks, scores, part, neg)
    hard &= ~bg
    lab, k = ndimage.label(hard)
    if k:
        sizes = ndimage.sum(hard, lab, range(1, k + 1))
        hard = np.isin(lab, [j + 1 for j, s in enumerate(sizes) if s > 0.005 * sizes.max()])
    hard = ndimage.binary_fill_holes(hard) if fix.get("fill") else hard
    alpha = matte(im, hard)
    Image.fromarray(alpha).resize((im.width // 2, im.height // 2), Image.LANCZOS).save(
        os.path.join(args.out, key + ".png"), optimize=True)
    if args.debug:
        Image.fromarray(alpha).save(os.path.join(args.debug, key + ".png"))
        json.dump({"objects": [{"box": [int(v) for v in o[0]], "pos": o[1]} for o in objects], "neg": neg_auto + remove},
                  open(os.path.join(args.debug, key + ".json"), "w"))


keys = args.keys or sorted(os.path.basename(f)[:-5] for f in glob.glob(os.path.join(ROOT, "public/products/*.webp")))
for key in keys:
    process(key)
    print(key, flush=True)
