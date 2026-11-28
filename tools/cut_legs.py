"""Cut the bare mannequin legs under shorts / short skirts / rompers: fade just below the
hem (found from public/masks/<id>-<n>.png), then re-centre the look in the 1080x1350 frame.
Leggings, flares and long jumpsuits keep their legs (the fabric covers them).
Usage: python tools/cut_legs.py <framed_dir> <out_dir>   (re-run garment_masks.py afterwards)"""
import json, os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
framed, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
W, H, FILL = 1080, 1350, 0.88
cat = json.load(open(os.path.join(ROOT, "src/data/catalog.json"), encoding="utf8"))["products"]


def resize_premult(im, size):
    a = np.asarray(im).astype(np.float32) / 255
    a[..., :3] *= a[..., 3:4]
    ch = [Image.fromarray(a[..., c]).resize(size, Image.LANCZOS) for c in range(4)]
    r = np.stack([np.asarray(c) for c in ch], -1)
    al = np.clip(r[..., 3:4], 1e-4, 1)
    r[..., :3] = np.where(r[..., 3:4] > 1e-3, r[..., :3] / al, 0)
    return Image.fromarray((np.clip(r, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


done = 0
for p in cat:
    short = p["type"] == "macaquinho" or p.get("bottom") in ("short", "saia")
    for n, idx in enumerate(p["photos"]):
        src = os.path.join(framed, f"{idx:02d}.png")
        im = Image.open(src).convert("RGBA")
        if not short:
            continue
        mask = np.asarray(Image.open(os.path.join(ROOT, "public/masks", f"{p['id']}-{n}.png")).convert("L").resize(im.size, Image.LANCZOS)) > 128
        rows = np.where(mask.sum(1) > 25)[0]
        arr = np.asarray(im).copy()
        alpha_rows = np.where((arr[..., 3] > 40).any(1))[0]
        top, hem, bottom = alpha_rows[0], rows[-1], alpha_rows[-1]
        span = hem - top
        below, fade = max(10, int(0.03 * span)), max(10, int(0.03 * span))
        if bottom - hem < below + fade + 10:
            continue  # legs already end at the hem
        y0 = hem + below
        ramp = np.ones(arr.shape[0])
        ramp[y0:y0 + fade] = np.linspace(1, 0, fade) ** 1.5
        ramp[y0 + fade:] = 0
        arr[..., 3] = (arr[..., 3] * ramp[:, None]).astype(np.uint8)
        cut = Image.fromarray(arr, "RGBA")
        cut = cut.crop(cut.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox())
        s = min(W * FILL / cut.width, H * FILL / cut.height)
        cut = resize_premult(cut, (round(cut.width * s), round(cut.height * s)))
        c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        c.alpha_composite(cut, ((W - cut.width) // 2, (H - cut.height) // 2 + 8))
        c.save(os.path.join(out, f"{idx:02d}.png"))
        done += 1
        print(p["id"], n, "cut at", y0, flush=True)
print(done, "photos cut")
