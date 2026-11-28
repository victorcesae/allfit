// Link previews for shared bags and products.
// The part after "#" never reaches a server, so WhatsApp/Instagram crawlers can't see
// "#s=15PP". Share links therefore use real paths, rewritten here by vercel.json:
//   /s/15PP.27M2  -> shared bag   (preview: the look's photo when it is a single item)
//   /p/p15        -> one product
// The HTML carries Open Graph tags for crawlers (they don't run JS); people are sent
// straight on to the store (/#s=... or /#p15), which the React app already understands.
import { PRODUCTS as products, COLORS } from "./_products.js";

const SIZES = ["GG", "XG", "PP", "P", "M", "G"]; // longest first so "PP"/"GG" win over "P"/"G"
const ITEM = new RegExp(`^(\\d{1,3})(${SIZES.join("|")})(\\d{0,2})(?:C(\\d{1,2}))?$`); // C<n> = palette colour
const TYPE = { conjunto: "Conjunto", top: "Top", cropped: "Cropped", macaquinho: "Macaquinho", macacao: "Macacão" };

const PLUS = ["GG", "XG"], PLUS_FEE = 15; // keep in sync with src/config.ts
const brl = (v) => "R$ " + (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ","));
const lineTotal = (i) => (i.product.price + (PLUS.includes(i.size) ? PLUS_FEE : 0)) * i.qty;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const byId = (id) => products.find((p) => p.id === id);

function parseBag(code) {
  const items = [];
  for (const part of String(code || "").split(".")) {
    const m = ITEM.exec(part.trim().toUpperCase());
    if (!m) continue;
    const product = byId(`p${m[1].padStart(2, "0")}`);
    const color = m[4] !== undefined && COLORS[Number(m[4])] ? COLORS[Number(m[4])] : product?.color;
    if (product) items.push({ product, size: m[2], qty: Math.min(20, Math.max(1, Number(m[3] || 1))), color, ci: m[4] });
  }
  return items;
}

export default function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "useallfit.vercel.app";
  const origin = `https://${host}`;
  const { code, p } = req.query || {};

  let title = "allFit · Moda fitness feminina";
  let description = "Conforto, estilo e performance para o seu dia. Escolha o look e peça pelo WhatsApp.";
  let image = `${origin}/og.jpg`;
  let alt = "allFit: moda fitness feminina";
  let imageType = "image/jpeg";
  let target = "/";
  let self = origin + "/";

  if (p) {
    const product = byId(String(p).toLowerCase());
    if (product) {
      title = `${product.name} · ${product.color} | allFit`;
      description = `${TYPE[product.type] || "Peça"} · ${brl(product.price)}. Escolha a cor e o tamanho e peça pelo WhatsApp.`;
      image = `${origin}/og/${product.id}.jpg`;
      alt = `${product.name} na cor ${product.color}`;
      target = `/#${product.id}`;
      self = `${origin}/p/${product.id}`;
    }
  } else if (code) {
    const items = parseBag(code);
    if (items.length) {
      const first = items[0];
      const count = items.reduce((n, i) => n + i.qty, 0);
      if (items.length === 1) {
        title = `${first.product.name} · ${first.color} | allFit`;
        description = `${first.qty}x tamanho ${first.size}, cor ${first.color} · ${brl(lineTotal(first))}. Toque para ver e pedir pelo WhatsApp.`;
      } else {
        title = `Sacola allFit · ${count} peças`;
        const total = items.reduce((n, i) => n + lineTotal(i), 0);
        description = `Total ${brl(total)} · ` + items.slice(0, 3).map((i) => `${i.qty}x ${i.product.name} (${i.color}, ${i.size})`).join(" · ") + (items.length > 3 ? " …" : "");
      }
      const clean = items.map((i) => `${Number(i.product.id.slice(1))}${i.size}${i.qty > 1 ? i.qty : ""}${i.ci !== undefined ? `c${i.ci}` : ""}`).join(".");
      if (items.length === 1) {
        image = `${origin}/og/${first.product.id}.jpg`;
        alt = `${first.product.name} na cor ${first.product.color}`;
      } else {
        // all the looks together in one picture (api/bag-image.js)
        // all the looks together in one picture (api/bag-image.js)
        image = `${origin}/api/bag-image?code=${encodeURIComponent(clean)}`;
        alt = `Sacola allFit com ${count} peças: ` + items.map((i) => i.product.name).join(", ");
      }
      target = `/#s=${clean}`;
      self = `${origin}/s/${clean}`;
    }
  }

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:site_name" content="allFit" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(self)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:secure_url" content="${esc(image)}" />
<meta property="og:image:type" content="${imageType}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${esc(alt)}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${esc(self)}" />
<link rel="icon" href="/favicon.ico" />
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body style="font-family:system-ui,sans-serif;background:#fdf6f1;color:#3a1d2b;text-align:center;padding:48px 16px">
<p><a href="${esc(target)}" style="color:#c03d72">Abrir na loja allFit</a></p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=3600"); // short: prices and colours change
  res.status(200).send(html);
}
