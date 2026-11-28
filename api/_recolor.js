// Server-side colour simulation for link previews: the same algorithm as src/recolor.ts
// (keep them in sync), applied to a product's studio look with its mask.
// Mannequin photos are never recoloured: products without a full look get their photo as it is.
import sharp from "sharp";
import { PRODUCTS, COLORS, COLOR_HEX, COLOR_SLUG } from "./_products.js";

export const byId = (id) => PRODUCTS.find((p) => p.id === id);
/** palette index from "17", "azul", "verde-militar" or "Verde militar"; -1 when unknown */
export function colorIndex(c) {
  if (c === undefined || c === null || c === "") return -1;
  const s = String(c).toLowerCase();
  if (/^\d{1,2}$/.test(s)) return Number(s) < COLORS.length ? Number(s) : -1;
  const i = COLOR_SLUG.indexOf(s);
  return i >= 0 ? i : COLORS.findIndex((n) => n.toLowerCase() === s);
}
export const hasLook = (p) => p.looks > 0 && !p.looksPartial;

export const fetchBuf = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
};

const hexToRgb = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * The product's front picture as a sharp-ready PNG buffer: its studio look, painted in palette
 * colour `ci` when that is not the photographed colour (-1 = as photographed).
 */
export async function lookImage(origin, p, ci = -1) {
  const src = hasLook(p) ? `${origin}/products/${p.id}-l0.webp` : `${origin}/products/${p.id}-0.webp`;
  const photo = await fetchBuf(src);
  if (!hasLook(p) || ci < 0 || COLORS[ci] === p.color) return sharp(photo).png().toBuffer();
  const img = sharp(photo).removeAlpha();
  const { width: w, height: h } = await img.metadata();
  const [rgb, mask] = await Promise.all([
    img.raw().toBuffer(),
    fetchBuf(`${origin}/masks/${p.id}-l0.png`).then((b) => sharp(b).greyscale().resize(w, h).raw().toBuffer()),
  ]);
  // average brightness of the fabric (ignoring prints/tags) = the "1.0" of the shading
  let sum = 0, cnt = 0;
  for (let i = 0, j = 0; j < mask.length; i += 3, j++) {
    if (mask[j] < 200) continue;
    sum += 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2]; cnt++;
  }
  if (!cnt) return sharp(photo).png().toBuffer();
  const mean = Math.max(8, sum / cnt);
  const [tr, tg, tb] = hexToRgb(COLOR_HEX[ci]);
  for (let i = 0, j = 0; j < mask.length; i += 3, j++) {
    const a = mask[j] / 255;
    if (a <= 0.01) continue;
    const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx ? (mx - mn) / mx : 0;
    if (L > mean * 1.45 && sat < 0.3 && L > 150) continue; // logo print / white tag: keep
    let s = L / mean;
    s = s < 1 ? Math.pow(s, 0.9) : s;
    const k = (t) => (s <= 1 ? t * s : t + (255 - t) * Math.min(1, (s - 1) * 0.55));
    rgb[i] = r + (k(tr) - r) * a;
    rgb[i + 1] = g + (k(tg) - g) * a;
    rgb[i + 2] = b + (k(tb) - b) * a;
  }
  return sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}
