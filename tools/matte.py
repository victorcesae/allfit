"""Background removal that KEEPS the mannequin and hang tags, with smooth (non-pixelated) edges.
BiRefNet (ONNX weights via rembg, high-res matting) gives the soft alpha; segformer's person mask
(dilated) limits it so props around the mannequin (plants, vase, flowers) are dropped.
Usage: python matte.py <looks_dir> <out_dir> [index ...]"""
import os, sys, glob
import numpy as np, torch
from PIL import Image, ImageOps
from scipy import ndimage
from rembg import new_session, remove
from transformers import SegformerImageProcessor, AutoModelForSemanticSegmentation

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
files = sorted(glob.glob(os.path.join(src, "*.jpeg")))
idx = [int(a) for a in sys.argv[3:]] or range(len(files))

session = new_session(os.environ.get("MATTE_MODEL", "birefnet-general"))
proc = SegformerImageProcessor.from_pretrained("mattmdjaga/segformer_b2_clothes")
segm = AutoModelForSemanticSegmentation.from_pretrained("mattmdjaga/segformer_b2_clothes").eval()


def letterbox(im):
    a = np.asarray(im.convert("L"))
    r = np.where(a.mean(1) > 12)[0]
    return im.crop((0, r[0], im.width, r[-1] + 1))


for i in idx:
    im = letterbox(ImageOps.exif_transpose(Image.open(files[i])).convert("RGB"))
    if max(im.size) > 2000:
        im.thumbnail((2000, 2000), Image.LANCZOS)
    alpha = np.asarray(remove(im, session=session, only_mask=True)).astype(np.float32)
    with torch.no_grad():
        lg = segm(**proc(images=im, return_tensors="pt")).logits
        seg = torch.nn.functional.interpolate(lg, size=im.size[::-1], mode="bilinear").argmax(1)[0].numpy()
    person = seg > 0
    lab, n = ndimage.label(person)
    if n:
        sizes = ndimage.sum(person, lab, range(1, n + 1))
        person = lab == (1 + int(np.argmax(sizes)))
    zone = ndimage.binary_dilation(ndimage.binary_fill_holes(person), iterations=int(0.035 * max(im.size)))
    a = alpha * np.clip(ndimage.gaussian_filter(zone.astype(np.float32), 8) * 1.2, 0, 1)
    m = a > 40
    lab, n = ndimage.label(m)
    if n > 1:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        keep = np.isin(lab, [k + 1 for k, s in enumerate(sizes) if s > 0.02 * sizes.max()])
        a *= ndimage.binary_dilation(keep, iterations=3)
    if 12 <= i <= 33:  # torso-only shots of a top: drop the legging the torso wears + fade below the hem
        if i not in (21, 24, 25, 29):  # dark tops: can't tell them from the black legging by colour
            ys = np.where((a > 40).any(1))[0]
            y_cut = ys[0] + int(0.62 * (ys[-1] - ys[0]))
            dark = np.asarray(im).max(-1) < 80
            dark[:y_cut] = False
            dark = ndimage.binary_opening(dark, iterations=2)
            dark = ndimage.binary_dilation(dark, iterations=4)
            a *= 1 - np.clip(ndimage.gaussian_filter(dark.astype(np.float32), 2.5), 0, 1)
        top = np.isin(seg, [4, 7])
        rows = np.where(top.sum(1) > 0.05 * top.shape[1])[0]
        if len(rows):
            y0 = rows[-1] + int(0.04 * im.height); y1 = y0 + int(0.07 * im.height)
            ramp = np.clip((y1 - np.arange(im.height)) / max(1, y1 - y0), 0, 1).astype(np.float32)
            a *= (ramp * ramp * (3 - 2 * ramp))[:, None]
    rgba = im.copy()
    rgba.putalpha(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)))
    rgba.save(os.path.join(out, f"{i:02d}.png"))
    print(i, "ok", flush=True)
