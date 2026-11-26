// 1200x630 collage for multi-item shared bags (/s/27M2.5G.36GG): every look side by side,
// so the WhatsApp/Instagram preview shows the whole bag in one picture.
// GET /api/bag-image?code=27M2.5G.36GG
import { ImageResponse } from "@vercel/og";
import { PRODUCTS } from "./_products.js";

export const config = { runtime: "edge" };

const SIZES = ["GG", "PP", "P", "M", "G"];
const ITEM = new RegExp(`^(\\d{1,3})(${SIZES.join("|")})(\\d{0,2})$`);
const products = PRODUCTS;

function parseBag(code) {
  const items = [];
  for (const part of String(code || "").split(".")) {
    const m = ITEM.exec(part.trim().toUpperCase());
    if (!m) continue;
    const product = products.find((p) => p.id === `p${m[1].padStart(2, "0")}`);
    if (product) items.push({ product, size: m[2], qty: Math.min(20, Math.max(1, Number(m[3] || 1))) });
  }
  return items;
}

// tiny element helper (no JSX build step needed)
const h = (type, style, children) => ({ type, props: { style, children } });

export default async function handler(req) {
  const url = new URL(req.url);
  const origin = url.origin;
  const items = parseBag(url.searchParams.get("code")).slice(0, 12);
  if (!items.length) return Response.redirect(`${origin}/og.jpg`, 302);

  const count = items.reduce((n, i) => n + i.qty, 0);
  const shown = items.slice(0, 4);
  const extra = items.length - shown.length;
  const font = await fetch(`${origin}/og/fraunces-600.woff`).then((r) => r.arrayBuffer());

  const tileW = shown.length === 1 ? 420 : Math.floor((1200 - 80 - (shown.length - 1) * 16) / shown.length);
  const tiles = shown.map((it, i) =>
    h("div", { display: "flex", flexDirection: "column", alignItems: "center", width: tileW, position: "relative" }, [
      { type: "img", props: { src: `${origin}/og/thumb/${it.product.id}.jpg`, width: tileW, height: Math.round(tileW * 1.25) > 440 ? 440 : Math.round(tileW * 1.25), style: { objectFit: "cover", borderRadius: 10 } } },
      h("div", { display: "flex", marginTop: 10, fontSize: 22, color: "#3a1d2b" }, `${it.qty}x · Tam. ${it.size}`),
      extra > 0 && i === shown.length - 1
        ? h("div", { position: "absolute", top: 0, left: 0, width: tileW, height: 440, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(58,29,43,0.55)", color: "#fff", fontSize: 56, borderRadius: 10, fontFamily: "Fraunces" }, `+${extra}`)
        : null,
    ].filter(Boolean)),
  );

  return new ImageResponse(
    h("div", { width: 1200, height: 630, display: "flex", flexDirection: "column", background: "#f7f0ed", padding: "28px 40px", fontFamily: "Fraunces" }, [
      h("div", { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }, [
        { type: "img", props: { src: `${origin}/logo.png`, height: 70, width: Math.round(70 * 360 / 206) } },
        h("div", { display: "flex", fontSize: 40, color: "#3a1d2b" }, `Sacola allFit · ${count} ${count === 1 ? "peça" : "peças"}`),
      ]),
      h("div", { display: "flex", gap: 16, justifyContent: "center", alignItems: "flex-start" }, tiles),
    ]),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "Fraunces", data: font, weight: 600, style: "normal" }],
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable" },
    },
  );
}
