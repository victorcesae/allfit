import data from "./data/catalog.json";
import palette from "./data/colors.json";
import { asset } from "./config";

export type ProductType = "conjunto" | "top" | "cropped" | "macaquinho" | "macacao";
export type Bottom = "short" | "legging" | "flare" | "saia";

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  bottom?: Bottom;
  color: string;
  /** exact shade in the photo (e.g. "Verde Bandeira"); color is the store colour it maps to */
  photoColor?: string;
  hex: string;
  photos: number[];
  /** studio looks (invisible mannequin): 1 = front, 2 = front + back; public/products/<id>-l<n>.webp */
  looks?: number;
  /** the looks show only part of the product (p07: the blouse, not the legging): mannequin photos first */
  looksPartial?: boolean;
  /** base price in R$ */
  price: number;
}

export const products = data.products as Product[];

export const imageUrl = (p: Product, n = 0) => asset(`products/${p.id}-${n}.webp`);
export const viewLabel = (n: number) => (n === 0 ? "Frente" : n === 1 ? "Costas" : `Detalhe ${n - 1}`);

/** One picture of a product: a studio look or a photo on the mannequin, with its colour mask. */
export interface View {
  src: string;
  mask: string;
  label: string;
  kind: "look" | "photo";
}

/** Every picture of a product: the studio looks first, then the real photos on the mannequin. */
export function views(p: Product): View[] {
  const looks = Array.from({ length: p.looks ?? 0 }, (_, n): View => ({
    src: asset(`products/${p.id}-l${n}.webp`),
    mask: asset(`masks/${p.id}-l${n}.png`),
    label: p.looksPartial ? (n === 0 ? "Estúdio" : "Est. costas") : n === 0 ? "Frente" : "Costas",
    kind: "look",
  }));
  const photos = p.photos.map((_, n): View => ({
    src: imageUrl(p, n),
    mask: asset(`masks/${p.id}-${n}.png`),
    label: looks.length && !p.looksPartial ? (n === 0 ? "Manequim" : n === 1 ? "Man. costas" : `Detalhe ${n - 1}`) : viewLabel(n),
    kind: "photo",
  }));
  return p.looksPartial ? [...photos, ...looks] : [...looks, ...photos];
}

/** The picture that represents the product (cards, bag, share): its studio look when it has one. */
export const coverUrl = (p: Product) => (p.looks && !p.looksPartial ? asset(`products/${p.id}-l0.webp`) : imageUrl(p, 0));

export const TYPES: { id: string; label: string; match: (p: Product) => boolean }[] = [
  { id: "all", label: "Tudo", match: () => true },
  { id: "conjunto", label: "Conjuntos", match: (p) => p.type === "conjunto" },
  { id: "top", label: "Tops", match: (p) => p.type === "top" },
  { id: "cropped", label: "Croppeds", match: (p) => p.type === "cropped" },
  { id: "macaquinho", label: "Macaquinhos & Macacões", match: (p) => p.type === "macaquinho" || p.type === "macacao" },
];

export const BOTTOMS: { id: Bottom; label: string }[] = [
  { id: "short", label: "Com short" },
  { id: "legging", label: "Com legging" },
  { id: "flare", label: "Com flare" },
  { id: "saia", label: "Com short saia" },
];

export const FAMILIES: { id: string; label: string; swatch: string }[] = [
  { id: "rosa", label: "Rosa & Pink", swatch: "#ff1a8c" },
  { id: "laranja", label: "Laranja & Coral", swatch: "#f2582c" },
  { id: "vermelho", label: "Vermelho & Vinho", swatch: "#c21f35" },
  { id: "roxo", label: "Roxo & Lilás", swatch: "#9a5fd0" },
  { id: "azul", label: "Azul", swatch: "#1f7fe0" },
  { id: "marinho", label: "Azul Marinho", swatch: "#1e2a44" },
  { id: "verde", label: "Verde", swatch: "#1f8a6a" },
  { id: "marrom", label: "Marrom", swatch: "#5a3424" },
  { id: "preto", label: "Preto & Grafite", swatch: "#141418" },
  { id: "neutro", label: "Branco & Gelo", swatch: "#e9e7e2" },
];

export const typeLabel: Record<ProductType, string> = {
  conjunto: "Conjunto",
  top: "Top",
  cropped: "Cropped",
  macaquinho: "Macaquinho",
  macacao: "Macacão",
};

/** Store palette: every colour the store produces (src/data/colors.json). */
export interface StoreColor { name: string; hex: string }
export const COLORS = palette.colors as StoreColor[];
export const colorByName = (name: string) => COLORS.find((c) => c.name === name);
