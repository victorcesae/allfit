"""Find the mannequin nipple bumps on framed front photos (pairs of small blobs, symmetric
around the garment centre, in the bust band). Writes bumps.json {photo: [[x,y],[x,y]]}.
Usage: python find_bumps.py <framed_dir> <out_json> <photo> ..."""
import sys, json, os
import numpy as np
from PIL import Image
from scipy import ndimage

def bust_band(a, one_piece):
    # rows of the upper garment piece: first alpha component from the top
    rows = a.any(1); ys = np.where(rows)[0]; y0 = ys[0]
    gap = np.where(~rows[y0:])[0]
    y1 = y0 + gap[0] if len(gap) else ys[-1]
    if one_piece or y1 - y0 > 0.6 * (ys[-1] - y0):
        y1 = y0 + int(0.38 * (ys[-1] - y0)) if (ys[-1] - y0) > 700 else y1
    return y0, y1

def find(path, one_piece=False):
    im = Image.open(path); a = np.asarray(im.getchannel("A")) > 128
    rgb = np.asarray(im.convert("RGB")).astype(float)
    L = rgb.mean(-1)
    y0, y1 = bust_band(a, one_piece)
    inner = ndimage.binary_erosion(a, iterations=25)
    sat = rgb.max(-1) - rgb.min(-1)
    best = None
    for sigma in (5, 7, 9):
        # bright-bump response (negative LoG), plus dark-bump for dark fabrics
        resp = -ndimage.gaussian_laplace(L, sigma) * sigma ** 2
        for sign in (1, -1):
            r = resp * sign
            r[~inner] = 0; r[:y0 + int(0.15 * (y1 - y0))] = 0; r[y1:] = 0
            r[(L > 225) & (sat < 40)] = 0                      # white logo prints
            mx = (r == ndimage.maximum_filter(r, size=31)) & (r > 1.2)
            cand = [(r[y, x], x, y) for y, x in zip(*np.where(mx))]
            cand.sort(reverse=True); cand = cand[:25]
            xs = np.where(a[y0:y1].any(0))[0]; cx = (xs[0] + xs[-1]) / 2; w = xs[-1] - xs[0]
            for i in range(len(cand)):
                for j in range(i + 1, len(cand)):
                    s1, x1, Y1 = cand[i]; s2, x2, Y2 = cand[j]
                    dx = abs(x1 - x2); mid = (x1 + x2) / 2
                    if abs(Y1 - Y2) > 30 or not (0.2 * w < dx < 0.55 * w) or abs(mid - cx) > 0.12 * w:
                        continue
                    score = min(s1, s2) - 0.02 * abs(Y1 - Y2)
                    if best is None or score > best[0]:
                        best = (score, sorted([[int(x1), int(Y1)], [int(x2), int(Y2)]]), sigma)
    return best

if __name__ == "__main__":
    d, out = sys.argv[1], sys.argv[2]
    res = {}
    for p in sys.argv[3:]:
        b = find(os.path.join(d, f"{int(p):02d}.png"))
        res[p] = {"pts": b[1], "score": round(float(b[0]), 2), "sigma": b[2]} if b else None
        print(p, res[p])
    json.dump(res, open(out, "w"), indent=1)
