// Store settings — edit these.
export const STORE = {
  name: "allFit",
  // Owner's WhatsApp: country code + area code + number, digits only. e.g. "5511999998888"
  whatsapp: "5571993861931",
  instagram: "use.allfit", // handle without @
  sizes: ["P", "M", "G", "GG", "XG"],
  /** Plus Size: these sizes cost plusFee more */
  plusSizes: ["GG", "XG"],
  plusFee: 15,
  /** discount for paying à vista (shown next to the price and in the WhatsApp total) */
  cashDiscount: 0.05,
};

/** "5571993861931" -> "(71) 99386-1931" */
export const phoneLabel = (() => {
  const d = STORE.whatsapp.replace(/\D/g, "").replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d;
})();

/** Path of a file in /public, respecting the deploy base (e.g. /allfit/ on GitHub Pages). */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

export const instagramUrl = STORE.instagram ? `https://www.instagram.com/${STORE.instagram.replace(/^@/, "")}/` : "";
export const instagramLabel = STORE.instagram ? `@${STORE.instagram.replace(/^@/, "")}` : "";

const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 2 });
/** 110 -> "R$ 110", 104.5 -> "R$ 104,50" */
export const money = (v: number) => {
  const s = brl0.format(v).replace(/\u00a0/g, " ");
  return Number.isInteger(v) ? s : s.replace(/,(\d)$/, (_, d: string) => `,${d}0`); // 104,5 -> 104,50
};
export const isPlus = (size: string) => STORE.plusSizes.includes(size);
/** unit price for a size (Plus Size adds the fee) */
export const unitPrice = (base: number, size?: string | null) => base + (size && isPlus(size) ? STORE.plusFee : 0);
export const cashPrice = (v: number) => Math.round(v * (1 - STORE.cashDiscount) * 100) / 100;
