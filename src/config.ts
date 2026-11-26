// Store settings — edit these.
export const STORE = {
  name: "allFit",
  // Owner's WhatsApp: country code + area code + number, digits only. e.g. "5511999998888"
  whatsapp: "5571993861931",
  instagram: "",
  sizes: ["P", "M", "G", "GG"],
};

/** "5571993861931" -> "(71) 99386-1931" */
export const phoneLabel = (() => {
  const d = STORE.whatsapp.replace(/\D/g, "").replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d;
})();

/** Path of a file in /public, respecting the deploy base (e.g. /allfit/ on GitHub Pages). */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
