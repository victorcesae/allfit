"""Hero looks (public/hero/look-1/2.webp): two framed photos scaled so mannequin tops and
shorts hems line up, cut just below the hem with a soft fade (no mannequin legs).
Usage: python tools/hero_looks.py <framed_dir> <photo-1> <photo-2>"""
import os, sys
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
framed, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
SPAN, BELOW, FADE = 820, 26, 22   # top->hem height, px kept under the hem, fade length

def measure(im):
    arr = np.asarray(im); alpha = arr[..., 3] > 40
    hsv = np.asarray(Image.fromarray(arr[..., :3]).convert("HSV")).astype(int)
    pink = alpha & ((hsv[..., 0] > 200) | (hsv[..., 0] < 12)) & (hsv[..., 1] > 110) & (hsv[..., 2] > 120)
    return np.where(alpha.any(1))[0][0], np.where(pink.sum(1) > 40)[0][-1]

for name, idx in (("look-1", a), ("look-2", b)):
    im = Image.open(os.path.join(framed, f"{idx:02d}.png")).convert("RGBA")
    top, hem = measure(im); s = SPAN / (hem - top)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    t, hm = round(top * s), round(hem * s)
    box = im.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
    im = im.crop((box[0], t, box[2], hm + BELOW))
    arr = np.asarray(im).copy(); H = arr.shape[0]
    ramp = np.ones(H); ramp[H - FADE:] = np.linspace(1, 0, FADE) ** 1.5
    arr[..., 3] = (arr[..., 3] * ramp[:, None]).astype(np.uint8)
    Image.fromarray(arr, "RGBA").save(os.path.join(ROOT, "public/hero", f"{name}.webp"), quality=90, method=6)
    print(name, im.size)
