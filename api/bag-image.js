// 1200x630 collage for multi-item shared bags (/s/27M2.5G.36GG): the looks side by side,
// so the WhatsApp/Instagram preview shows the whole bag in one picture.
// GET /api/bag-image?code=27M2.5G.36GG
// Text is pre-rendered (public/og/label/*.png): no fonts are needed on the server.
import sharp from "sharp";
import { PRODUCTS } from "./_products.js";

const W = 1200, H = 630, PAD = 40, GAP = 16, TOP = 120;
const BG = { r: 247, g: 240, b: 237, alpha: 1 };
const SIZES = ["GG", "PP", "P", "M", "G"];
const ITEM = new RegExp(`^(\\d{1,3})(${SIZES.join("|")})(\\d{0,2})$`);

function parseBag(code) {
  const items = [];
  for (const part of String(code || "").split(".")) {
    const m = ITEM.exec(part.trim().toUpperCase());
    if (!m) continue;
    const id = `p${m[1].padStart(2, "0")}`;
    if (PRODUCTS.some((p) => p.id === id)) items.push({ id, qty: Math.min(20, Math.max(1, Number(m[3] || 1))) });
  }
  return items;
}

const fetchBuf = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
};

export default async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "useallfit.vercel.app";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const origin = `${proto}://${host}`;
  const items = parseBag(req.query?.code);
  if (!items.length) {
    res.writeHead(302, { Location: "/og.jpg" }).end();
    return;
  }
  try {
    const count = items.reduce((n, i) => n + i.qty, 0);
    const shown = items.slice(0, 4);
    const extra = items.length - shown.length;
    const n = shown.length;

    // tile size: fill the width, keep 4:5 photos, never taller than the space below the header
    const maxH = H - TOP - 24;
    let tw = Math.floor((W - 2 * PAD - (n - 1) * GAP) / n);
    let th = Math.round(tw * 1.25);
    if (th > maxH) { th = maxH; tw = Math.round(th * 0.8); }
    const rowW = n * tw + (n - 1) * GAP;
    const x0 = Math.round((W - rowW) / 2);

    const [logo, label, ...thumbs] = await Promise.all([
      fetchBuf(`${origin}/logo.png`).then((b) => sharp(b).resize({ height: 72 }).png().toBuffer()),
      count >= 2 ? fetchBuf(`${origin}/og/label/n${Math.min(count, 60)}.png`) : null,
      ...shown.map((it) => fetchBuf(`${origin}/og/thumb/${it.id}.jpg`)),
    ]);

    const rounded = (w, h, r) => Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}"/></svg>`);
    const layers = [{ input: logo, left: PAD, top: 30 }];
    if (label) {
      const meta = await sharp(label).metadata();
      layers.push({ input: label, left: W - PAD - meta.width, top: 44 });
    }
    for (let i = 0; i < n; i++) {
      const tile = await sharp(thumbs[i])
        .resize(tw, th, { fit: "cover", position: "top" })
        .composite([{ input: rounded(tw, th, 10), blend: "dest-in" }])
        .png()
        .toBuffer();
      const left = x0 + i * (tw + GAP);
      layers.push({ input: tile, left, top: TOP });
      if (extra > 0 && i === n - 1) {
        const shade = Buffer.from(`<svg width="${tw}" height="${th}"><rect width="${tw}" height="${th}" rx="10" ry="10" fill="rgb(58,29,43)" fill-opacity="0.55"/></svg>`);
        layers.push({ input: shade, left, top: TOP });
        const plus = await fetchBuf(`${origin}/og/label/plus${Math.min(extra, 39)}.png`);
        layers.push({ input: plus, left: left + Math.round((tw - 160) / 2), top: TOP + Math.round((th - 90) / 2) });
      }
    }

    const png = await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
      .composite(layers)
      .jpeg({ quality: 84, progressive: true })
      .toBuffer();
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, immutable");
    res.status(200).send(png);
  } catch (err) {
    console.error("bag-image", err);
    res.writeHead(302, { Location: "/og.jpg" }).end();
  }
}
