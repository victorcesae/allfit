"""Export cutouts (from segment.py) using src/data/catalog.json:
  public/products/<id>-<n>.webp        -> used by the store
  recortes/<tipo>/<cor>/<id>-<view>.png -> organized originals
Usage: python export.py <cutout_dir> <photocraft_finished_dir>"""
import json, os, sys, shutil, unicodedata
from PIL import Image

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cut, fin = sys.argv[1], sys.argv[2]
cat = json.load(open(os.path.join(root, "src/data/catalog.json"), encoding="utf8"))["products"]
TYPE_DIR = {"conjunto": "conjuntos", "top": "tops", "cropped": "croppeds", "macaquinho": "macaquinhos", "macacao": "macacoes"}
VIEWS = ["frente", "costas", "extra1", "extra2"]
slug = lambda s: unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().replace(" & ", "-").replace(" ", "-")

web = os.path.join(root, "public/products"); org = os.path.join(root, "recortes")
for d in (web, org):
    shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
for p in cat:
    folder = os.path.join(org, TYPE_DIR[p["type"]], slug(p["color"]))
    os.makedirs(folder, exist_ok=True)
    for n, idx in enumerate(p["photos"]):
        im = Image.open(os.path.join(cut, f"{idx:02d}.png"))
        im.save(os.path.join(folder, f"{p['id']}-{slug(p['name'])}-{VIEWS[n]}.png"))
        w = Image.open(os.path.join(fin, f"{idx:02d}.webp")).convert("RGB")
        w.save(os.path.join(web, f"{p['id']}-{n}.webp"), quality=88, method=6)
print(len(cat), "products,", sum(len(p["photos"]) for p in cat), "images")
