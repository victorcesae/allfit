// 1200x630 product preview card in any palette colour: the card's text (public/og/base/<id>.png,
// made by tools/og_looks.py) + the studio look painted in that colour + its colour dot and name.
// GET /api/og-image?p=p04&c=azul   (c: palette slug, name or index; missing = photographed colour)
// The photographed colour is the static card public/og/<id>.jpg.
import sharp from "sharp";
import { COLORS, COLOR_HEX } from "./_products.js";
import { OG_LAYOUT } from "./_og_layout.js";
import { byId, colorIndex, fetchBuf, hasLook, lookImage } from "./_recolor.js";

const W = 1200, H = 630;

export default async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "useallfit.vercel.app";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const origin = `${proto}://${host}`;
  const p = byId(String(req.query?.p || "").toLowerCase());
  const ci = colorIndex(req.query?.c);
  if (!p) return res.writeHead(302, { Location: "/og.jpg" }).end();
  // photographed colour, or a product whose picture can't be recoloured: the static card
  if (ci < 0 || COLORS[ci] === p.color || !hasLook(p)) return res.writeHead(302, { Location: `/og/${p.id}.jpg` }).end();
  try {
    const L = OG_LAYOUT[p.id];
    const [base, look, label] = await Promise.all([
      fetchBuf(`${origin}/og/base/${p.id}.png`),
      lookImage(origin, p, ci).then((b) => sharp(b).resize(L.w, H).toBuffer()),
      fetchBuf(`${origin}/og/label/color-${ci}.png`),
    ]);
    const dot = Buffer.from(`<svg width="24" height="24"><circle cx="12" cy="12" r="11" fill="${COLOR_HEX[ci]}" stroke="#000" stroke-width="1"/></svg>`);
    const jpg = await sharp(base)
      .composite([
        { input: look, left: L.x, top: 0 },
        { input: dot, left: 73, top: L.colorY + 5 },
        { input: label, left: 110, top: L.colorY },
      ])
      .jpeg({ quality: 86, progressive: true })
      .toBuffer();
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
    res.status(200).send(jpg);
  } catch (err) {
    console.error("og-image", err);
    res.writeHead(302, { Location: `/og/${p.id}.jpg` }).end();
  }
}
