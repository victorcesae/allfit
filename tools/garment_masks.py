"""Garment masks for the colour preview: public/masks/<id>-<n>.png (half size, grayscale).
White = garment fabric (recoloured in the browser); black = mannequin, tags, backdrop.
Runs the clothes segmentation model on the framed photos (frame.py output), so the mask
lines up pixel-for-pixel with public/products/<id>-<n>.webp.
Usage: python tools/garment_masks.py <framed_dir>"""
import json, os, sys
import numpy as np, torch
from PIL import Image, ImageFilter
from scipy import ndimage
from transformers import SegformerImageProcessor, AutoModelForSemanticSegmentation

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
framed = sys.argv[1]
out = os.path.join(ROOT, "public/masks"); os.makedirs(out, exist_ok=True)
cat = json.load(open(os.path.join(ROOT, "src/data/catalog.json"), encoding="utf8"))["products"]
proc = SegformerImageProcessor.from_pretrained("mattmdjaga/segformer_b2_clothes")
model = AutoModelForSemanticSegmentation.from_pretrained("mattmdjaga/segformer_b2_clothes").eval()
GARMENT = [4, 5, 6, 7, 8]  # upper clothes, skirt, pants, dress, belt

for p in cat:
    for n, idx in enumerate(p["photos"]):
        im = Image.open(os.path.join(framed, f"{idx:02d}.png")).convert("RGBA")
        bg = Image.new("RGB", im.size, (247, 240, 237)); bg.paste(im, (0, 0), im)
        with torch.no_grad():
            lg = model(**proc(images=bg, return_tensors="pt")).logits
            seg = torch.nn.functional.interpolate(lg, size=bg.size[::-1], mode="bilinear").argmax(1)[0].numpy()
        alpha = np.asarray(im.getchannel("A")) > 128
        m = np.isin(seg, GARMENT) & alpha
        rgb = np.asarray(bg).astype(int)
        # keep the gold mannequin out even where the model blurs the edge
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        gold = (r > 120) & (r - b > 45) & (g > 85) & (abs(r - g) < 75) & (b < 150)
        m &= ~gold
        m = ndimage.binary_opening(m, iterations=2)
        m = ndimage.binary_closing(m, iterations=3)
        # grow into same-colour fabric the model misses (thin straps, edge fringe): pixels within
        # reach of the garment whose colour is close to the garment's median colour
        lab_img = np.asarray(bg.convert("LAB")).astype(float)
        core = ndimage.binary_erosion(m, iterations=6)
        if core.sum() > 500:
            ref = np.median(lab_img[core], axis=0)
            d = np.sqrt(((lab_img[..., 1:] - ref[1:]) ** 2).sum(-1) + 0.15 * (lab_img[..., 0] - ref[0]) ** 2)
            similar = (d < 22) & alpha & ~gold
            for _ in range(30):                      # region-grow up to ~300px from the garment (long straps)
                grown = ndimage.binary_dilation(m, iterations=10) & similar
                if (grown & ~m).sum() == 0:
                    break
                m |= grown
        lab, k = ndimage.label(m)
        if k:
            sizes = ndimage.sum(m, lab, range(1, k + 1))
            m = np.isin(lab, [j + 1 for j, s in enumerate(sizes) if s > 0.01 * sizes.max()])
        mask = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))
        mask = mask.resize((im.width // 2, im.height // 2), Image.LANCZOS)
        mask.save(os.path.join(out, f"{p['id']}-{n}.png"), optimize=True)
    print(p["id"], flush=True)
