"""Product looks from the collages in looks-novos/ -> site images.

For each product in tools/looks_map.json and each view (frente, costas):
  1. take the listed pieces out of the collage by their alpha (sets: top + bottom keep their layout),
  2. remove hang tags (SAM 2 on a click, fabric under the tag filled from its surroundings),
  3. upscale with Swin2SR (AI super-resolution: the collage pieces are only 250-500 px tall),
  4. frame on the 1080x1350 canvas the site uses,
  5. PhotoCraft: soft shadow + cream backdrop (same settings as tools/finish.sh), export
     public/products/<id>-l<n>.webp (n: 0 frente, 1 costas),
  6. colour-change mask public/masks/<id>-l<n>.png (half size, white = fabric).
The collages are only read.

Usage: .venv-ml/Scripts/python tools/looks_cut.py [--preview] [--work DIR] [id ...]
"""
import argparse, glob, json, os, subprocess
import numpy as np, torch, cv2
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "looks-novos")
W, H = 1080, 1350
CREAM = (247, 240, 237)                      # the product photos' backdrop (tools/finish.sh)
PC = os.environ.get("PHOTOCRAFT_CLI", r"C:\Program Files\ArtCraft\PhotoCraft\photocraft-cli.exe")
VIEWS = ["frente", "costas"]

ap = argparse.ArgumentParser()
ap.add_argument("--preview", action="store_true", help="write numbered piece maps of every collage and stop")
ap.add_argument("--work", default=os.path.join(ROOT, "recortes", "_looks_work"))
ap.add_argument("ids", nargs="*")
args = ap.parse_args()
MAP = {k: v for k, v in json.load(open(os.path.join(ROOT, "tools/looks_map.json"), encoding="utf8")).items()
       if not k.startswith("_")}
collages = sorted(glob.glob(os.path.join(SRC, "*.png")))


_matte = None


def load_rgba(path):
    """Collage as RGBA. Some re-exports are flat RGB on pure black: their transparency is recovered
    with ViTMatte around the garment edges and the black is un-mixed from the edge colours."""
    im = Image.open(path)
    a = np.asarray(im.convert("RGBA")).copy()
    if im.mode == "RGBA" and (a[..., 3] < 20).mean() > 0.2:
        return a
    global _matte
    from transformers import VitMatteImageProcessor, VitMatteForImageMatting
    if _matte is None:
        _matte = (VitMatteImageProcessor.from_pretrained("hustvl/vitmatte-base-composition-1k"),
                  VitMatteForImageMatting.from_pretrained("hustvl/vitmatte-base-composition-1k").eval())
    rgb = a[..., :3]
    hard = ndimage.binary_closing(rgb.max(-1) > 14, iterations=2)   # no hole filling: cut-outs stay open
    hard = ndimage.binary_opening(hard, iterations=1)
    fg = ndimage.binary_erosion(hard, iterations=4)
    unknown = ndimage.binary_dilation(hard, iterations=4) & ~fg
    tri = np.where(fg, 255, np.where(unknown, 128, 0)).astype(np.uint8)
    proc, model = _matte
    inp = proc(images=Image.fromarray(rgb), trimaps=Image.fromarray(tri), return_tensors="pt")
    with torch.no_grad(): al = model(**inp).alphas[0, 0].numpy()[: rgb.shape[0], : rgb.shape[1]]
    al = np.where(fg, 1.0, np.where(unknown, al.clip(0, 1), 0.0))
    # observed = alpha * F + (1 - alpha) * black  ->  F = observed / alpha (edges only)
    F = np.where(al[..., None] > 0.05, rgb / np.maximum(al[..., None], 0.05), 0).clip(0, 255)
    _, (iy, ix) = ndimage.distance_transform_edt(~fg, return_indices=True)
    F = np.where((al[..., None] < 0.35) & unknown[..., None], rgb[iy, ix], F)   # very faint edge: nearest fabric
    a[..., :3] = F.astype(np.uint8); a[..., 3] = (al * 255).astype(np.uint8)
    return a


def pieces(path):
    """Pieces of a collage: connected blobs of its alpha, ordered in rows then left to right."""
    a = load_rgba(path)
    fg = ndimage.binary_closing(a[..., 3] > 20, iterations=3)
    lab, k = ndimage.label(fg)
    objs = ndimage.find_objects(lab)
    sizes = ndimage.sum(fg, lab, range(1, k + 1))
    out = [(j + 1, o) for j, o in enumerate(objs) if sizes[j] > 1500]
    out.sort(key=lambda t: (((t[1][0].start + t[1][0].stop) // 2) // 200, t[1][1].start))
    return a, lab, [j for j, _ in out]


if args.preview:
    for ci, path in enumerate(collages):
        if args.ids and str(ci) not in args.ids: continue
        a, lab, order = pieces(path)
        im = Image.new("RGB", a.shape[1::-1], (255, 255, 255))
        im.paste(Image.fromarray(a), (0, 0), Image.fromarray(a))
        d = ImageDraw.Draw(im)
        for n, j in enumerate(order):
            ys, xs = np.nonzero(lab == j)
            d.rectangle([xs.min(), ys.min(), xs.max(), ys.max()], outline=(0, 180, 0), width=2)
            d.text((xs.min() + 4, ys.min() + 4), str(n), fill=(0, 0, 0))
        im.save(os.path.join(args.work, f"collage{ci}.jpg"), quality=85)
    raise SystemExit


torch.set_grad_enabled(False)
from transformers import Sam2Processor, Sam2Model, Swin2SRImageProcessor, Swin2SRForImageSuperResolution
sam_proc = Sam2Processor.from_pretrained("facebook/sam2.1-hiera-large")
sam_model = Sam2Model.from_pretrained("facebook/sam2.1-hiera-large").eval()
sr_proc = Swin2SRImageProcessor.from_pretrained("caidas/swin2SR-classical-sr-x2-64")
sr_model = Swin2SRForImageSuperResolution.from_pretrained("caidas/swin2SR-classical-sr-x2-64").eval()
cache = {}


def collage(ci):
    if ci not in cache: cache[ci] = pieces(collages[ci])
    return cache[ci]


def tag_mask(rgb, x, y, pick="score"):
    """The hang tag (card + string) under a click: SAM 2, smallest confident mask holding the point."""
    im = Image.fromarray(rgb)
    inp = sam_proc(images=im, input_points=[[[[int(x), int(y)]]]], input_labels=[[[1]]], return_tensors="pt")
    out = sam_model(**inp, multimask_output=True)
    masks = sam_proc.post_process_masks(out.pred_masks.cpu(), inp["original_sizes"])[0][0].numpy() > 0
    scores = out.iou_scores[0, 0].numpy()
    # the whole card: the largest candidate that holds the click and is still tag-sized
    ok = [i for i in range(len(masks)) if masks[i][y, x] and masks[i].sum() < 0.015 * masks[i].size]
    if not ok: m = np.zeros(rgb.shape[:2], bool)
    elif pick == "large": m = masks[max(ok, key=lambda i: masks[i].sum())]
    elif pick == "small": m = masks[min(ok, key=lambda i: masks[i].sum())]
    else: m = masks[max(ok, key=lambda i: scores[i])]
    # the tag string: thin magenta line near the card (thin = gone after a 2 px opening)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    c = rgb.astype(int)
    string = ((hsv[..., 0] > 145) & (hsv[..., 0] < 178) & (hsv[..., 1] > 70) & (hsv[..., 2] > 80)) |              ((c[..., 2] - c[..., 1] > 25) & (c[..., 0] > 120) & (c[..., 0] - c[..., 1] > 60))   # pink on coral/red
    string &= ndimage.binary_dilation(m, iterations=110)
    lab_, k = ndimage.label(string)        # string = small magenta pieces; a pink garment is one huge blob
    if k:
        sz = ndimage.sum(string, lab_, range(1, k + 1))
        string = np.isin(lab_, [j + 1 for j, v in enumerate(sz) if v < 2500])
    return ndimage.binary_dilation(m, iterations=5), ndimage.binary_dilation(string, iterations=3)


def upscale(rgb):
    """Swin2SR x2 in tiles (CPU memory), result as float RGB."""
    h, w = rgb.shape[:2]
    out = np.zeros((h * 2, w * 2, 3), np.float32)
    T, P = 256, 16
    for y0 in range(0, h, T):
        for x0 in range(0, w, T):
            ya, xa, yb, xb = max(0, y0 - P), max(0, x0 - P), min(h, y0 + T + P), min(w, x0 + T + P)
            tile = Image.fromarray(rgb[ya:yb, xa:xb])
            px = sr_proc(tile, return_tensors="pt").pixel_values
            o = sr_model(pixel_values=px).reconstruction[0].clamp(0, 1).permute(1, 2, 0).numpy()
            o = o[: (yb - ya) * 2, : (xb - xa) * 2]
            cy, cx = (y0 - ya) * 2, (x0 - xa) * 2
            hh, ww = min(T, h - y0) * 2, min(T, w - x0) * 2
            out[y0 * 2:y0 * 2 + hh, x0 * 2:x0 * 2 + ww] = o[cy:cy + hh, cx:cx + ww]
    return out * 255


def build(pid, view, spec, tags):
    ci, items = spec
    a, lab, order = collage(ci)
    keep = np.zeros(lab.shape, bool)
    for it in items:
        if isinstance(it, dict):
            part = lab == order[it["i"]]
            if "x" in it:
                xs = np.arange(lab.shape[1]); part &= ((xs >= it["x"][0]) & (xs < it["x"][1]))[None, :]
            if "y" in it:
                ys = np.arange(lab.shape[0]); part &= ((ys >= it["y"][0]) & (ys < it["y"][1]))[:, None]
        else:
            part = lab == order[it]
        keep |= part
    alpha = a[..., 3].astype(np.float32) / 255 * keep
    rgb = a[..., :3].copy()
    # tags
    for tg in tags:
        tg = tg if isinstance(tg, dict) else {"at": tg}
        (x, y), use_string = tg["at"], tg.get("string", True)
        card, string = tag_mask(np.where(alpha[..., None] > 0.1, rgb, 255).astype(np.uint8), x, y, tg.get("pick", "score"))
        t = card | (string if use_string else False)
        if not card.any(): print(f"  {pid} {view}: no tag found at {x},{y}"); continue
        fabric = (alpha > 0.5) & ~t
        # fabric hidden by the tag: the notch it leaves in the outline, closed (edge notches can be ~80 px)
        under = t & ndimage.binary_closing(np.pad(fabric, 45), iterations=40)[45:-45, 45:-45] & ~fabric
        # a string lying over fabric (a strap, the bodice): the fabric continues underneath
        if use_string:
            under |= string & ndimage.binary_closing(fabric | ~string & (alpha > 0.5), iterations=5) & ~card
        # where the tag hides the garment's side edge, carry the edge across row by row (interpolated
        # from the rows above and below), so the outline continues instead of showing a bite
        rows = np.nonzero(fabric.any(1))[0]
        L = np.full(fabric.shape[0], np.nan); R = L.copy()
        for r in rows:
            xs_ = np.nonzero(fabric[r])[0]; L[r], R[r] = xs_[0], xs_[-1]
        span = np.zeros_like(fabric)
        for side, E in (("L", L), ("R", R)):
            hid = np.array([r in rows and t[r, int(max(0, E[r] - 5)):int(E[r] + 6)].any() if not np.isnan(E[r]) else False
                            for r in range(len(E))])
            hid = ndimage.binary_dilation(hid, iterations=4) & ~np.isnan(E)
            good = ~hid & ~np.isnan(E)
            if hid.any() and good.sum() > 10:
                E2 = E.copy(); E2[hid] = np.interp(np.nonzero(hid)[0], np.nonzero(good)[0], E[good])
                for r in np.nonzero(hid)[0]:
                    if side == "L": span[r, int(E2[r]):int(np.nan_to_num(R[r], nan=E2[r])) + 1] = True
                    else: span[r, int(np.nan_to_num(L[r], nan=E2[r])):int(E2[r]) + 1] = True
        under |= t & span & ~fabric
        # fill colour only from fabric (never from the transparent collage background)
        _, (iy, ix) = ndimage.distance_transform_edt(~ndimage.binary_erosion(fabric, iterations=2), return_indices=True)
        base = rgb[iy, ix]
        rgb = np.where(fabric[..., None], rgb, cv2.inpaint(np.ascontiguousarray(base), (t * 255).astype(np.uint8), 9, cv2.INPAINT_TELEA))
        alpha = np.where(t, np.where(under, 1.0, 0.0), alpha).astype(np.float32)
        alpha = (cv2.GaussianBlur(alpha, (0, 0), 0.8) * (alpha > 0.02)).astype(np.float32)
    # leftovers (bits of string far from the garment) must not stretch the frame
    solid = alpha > 0.3
    lab_, k = ndimage.label(solid)
    if k > 1:
        sz = ndimage.sum(solid, lab_, range(1, k + 1))
        alpha = alpha * ndimage.binary_dilation(np.isin(lab_, [j + 1 for j, v in enumerate(sz) if v > 0.01 * sz.max()]), iterations=3)
    ys, xs = np.nonzero(alpha > 0.03)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    pad = 6
    y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
    y1, x1 = min(alpha.shape[0], y1 + pad), min(alpha.shape[1], x1 + pad)
    al = alpha[y0:y1, x0:x1]
    on_cream = (rgb[y0:y1, x0:x1].astype(np.float32) * al[..., None] + np.array(CREAM) * (1 - al[..., None]))
    big = upscale(np.clip(on_cream, 0, 255).astype(np.uint8))
    big_a = cv2.resize(al, (big.shape[1], big.shape[0]), interpolation=cv2.INTER_CUBIC).clip(0, 1)
    # frame: same fill as tools/frame.py (0.88 of the canvas)
    s = min(W * 0.84 / big.shape[1], H * 0.88 / big.shape[0])
    size = (round(big.shape[1] * s), round(big.shape[0] * s))
    interp = cv2.INTER_AREA if s < 1 else cv2.INTER_LANCZOS4
    big = cv2.resize(big, size, interpolation=interp)
    big_a = cv2.resize(big_a, size, interpolation=interp).clip(0, 1)
    canvas = np.zeros((H, W, 4), np.float32)
    ox, oy = (W - size[0]) // 2, (H - size[1]) // 2
    canvas[oy:oy + size[1], ox:ox + size[0], :3] = big
    canvas[oy:oy + size[1], ox:ox + size[0], 3] = big_a * 255
    return Image.fromarray(np.clip(canvas + 0.5, 0, 255).astype(np.uint8), "RGBA")


def photocraft(png, out_webp, cwd):
    cmd = [PC, "run", png,
           "--cmd", "layer.layerStyle.dropShadow", "--params", json.dumps(
               {"color": "#6b3346", "opacity": 20, "blend": "multiply", "angle": 90, "useGlobalLight": False,
                "distance": 18, "spread": 0, "size": 46}),
           "--cmd", "layer.newFillLayer.solidColor", "--params", json.dumps({"color": "#f7f0ed"}),
           "--cmd", "layer.arrange.sendToBack", "--params", "{}",
           "--out", out_webp, "--quality", "92"]
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf8")
    if r.returncode: raise RuntimeError(r.stderr)
    with Image.open(out_webp) as im:
        assert im.size == (W, H), im.size


os.makedirs(args.work, exist_ok=True)
for pid in args.ids or sorted(MAP):
    m = MAP[pid]
    for n, view in enumerate(VIEWS):
        if view not in m: continue
        im = build(pid, view, m[view], m.get("tags", {}).get(view, []))
        png = os.path.join(args.work, f"{pid}-l{n}.png")
        im.save(png)
        photocraft(png, os.path.join(ROOT, "public/products", f"{pid}-l{n}.webp"), args.work)
        a = im.getchannel("A").resize((W // 2, H // 2), Image.LANCZOS)
        a.save(os.path.join(ROOT, "public/masks", f"{pid}-l{n}.png"), optimize=True)
        print(pid, view, flush=True)
