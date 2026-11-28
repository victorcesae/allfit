import { products, COLORS } from "./catalog";
import { STORE } from "./config";
import type { BagItem } from "./whatsapp";

/**
 * Bag <-> short URL fragment. Each item is "<product number><size><qty if > 1><c + palette index>",
 * items joined by ".":  2x p27 in M + 1x p05 in G, recoloured to palette colour 17  ->  "27M2.5Gc17"
 * The colour part is left out when it is the photo's own colour.
 * The bag lives in the link itself, so it works on any static host with no backend.
 */
const SIZE_RE = [...STORE.sizes].sort((a, b) => b.length - a.length).join("|"); // GG before G
const ITEM_RE = new RegExp(`^(\\d{1,3})(${SIZE_RE})(\\d{0,2})(?:C(\\d{1,2}))?$`);

export function encodeBag(items: BagItem[]): string {
  return items
    .map(({ product, size, qty, color }) => {
      const ci = color !== product.color ? COLORS.findIndex((c) => c.name === color) : -1;
      return `${Number(product.id.slice(1))}${size}${qty > 1 ? qty : ""}${ci >= 0 ? `c${ci}` : ""}`;
    })
    .join(".");
}

export function decodeBag(code: string): BagItem[] {
  const out: BagItem[] = [];
  for (const part of code.split(".")) {
    const m = ITEM_RE.exec(part.trim().toUpperCase());
    if (!m) continue;
    const product = products.find((p) => p.id === `p${m[1].padStart(2, "0")}`);
    if (!product) continue;
    const qty = Math.min(20, Math.max(1, Number(m[3] || 1)));
    const color = m[4] !== undefined && COLORS[Number(m[4])] ? COLORS[Number(m[4])].name : product.color;
    const same = out.find((i) => i.product.id === product.id && i.size === m[2] && i.color === color);
    if (same) same.qty = Math.min(20, same.qty + qty);
    else out.push({ product, size: m[2], qty, color });
  }
  return out;
}

/** Reads "#s=..." from a location hash; null when the hash is not a shared bag. */
export function sharedBagFromHash(hash: string): BagItem[] | null {
  const m = /^#s=([\w.]+)$/.exec(hash);
  if (!m) return null;
  const items = decodeBag(m[1]);
  return items.length ? items : null;
}

/**
 * Absolute share link, e.g. https://useallfit.vercel.app/s/27M2.5G
 * A real path (not "#s=") so WhatsApp/Instagram can read its preview: api/share.js serves
 * Open Graph tags for it (the look's photo, or all looks together) and forwards people to "/#s=...".
 * In local dev there is no /s/ route, so the hash form is used.
 */
export function bagShareUrl(items: BagItem[]): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const code = encodeBag(items);
  return import.meta.env.DEV ? `${base}#s=${code}` : `${base}s/${code}`;
}
