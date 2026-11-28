import type { View } from "./catalog";

/**
 * Colour simulation: repaints the garment in a product picture with another palette colour,
 * keeping the picture's own folds and shading. The garment mask (public/masks/<id>-<n>.png from
 * tools/garment_masks.py, <id>-l<n>.png from tools/looks_cut.py) keeps the mannequin and backdrop untouched.
 */
const cache = new Map<string, Promise<string>>();

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`load ${src}`));
    img.src = src;
  });

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function recolored(view: View, hex: string, maxW = 1080): Promise<string> {
  const key = `${view.src}-${hex}-${maxW}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const job = (async () => {
    const [photo, mask] = await Promise.all([load(view.src), load(view.mask)]);
    const scale = Math.min(1, maxW / photo.naturalWidth);
    const w = Math.round(photo.naturalWidth * scale);
    const h = Math.round(photo.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(mask, 0, 0, w, h);
    const m = ctx.getImageData(0, 0, w, h).data;
    ctx.drawImage(photo, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    // average brightness of the fabric (ignoring prints/tags) = the "1.0" of the shading
    let sum = 0, cnt = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (m[i] < 200) continue;
      const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      sum += L; cnt++;
    }
    if (!cnt) return view.src;
    const mean = Math.max(8, sum / cnt);
    let [tr, tg, tb] = hexToRgb(hex);
    // very dark targets (Preto, Azul marinho): lift a little so folds and shading stay visible
    const tl = 0.299 * tr + 0.587 * tg + 0.114 * tb;
    if (tl < 38) { const lift = 38 - tl; tr += lift; tg += lift; tb += lift; }

    for (let i = 0; i < d.length; i += 4) {
      const a = m[i] / 255;
      if (a <= 0.01) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx ? (mx - mn) / mx : 0;
      if (L > mean * 1.45 && sat < 0.3 && L > 150) continue; // logo print / white tag: keep
      let s = L / mean;
      s = s < 1 ? Math.pow(s, 0.9) : s;                     // keep shadows, soften noise
      const k = (t: number) => (s <= 1 ? t * s : t + (255 - t) * Math.min(1, (s - 1) * 0.55));
      d[i] = r + (k(tr) - r) * a;
      d[i + 1] = g + (k(tg) - g) * a;
      d[i + 2] = b + (k(tb) - b) * a;
    }
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/webp", 0.9));
    return blob ? URL.createObjectURL(blob) : c.toDataURL("image/jpeg", 0.9);
  })();
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  return job;
}
