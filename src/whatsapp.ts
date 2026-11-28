import { STORE } from "./config";
import type { Product } from "./catalog";
import { bagShareUrl } from "./share";

export interface BagItem {
  product: Product;
  size: string;
  qty: number;
  /** colour the customer chose from the store palette (defaults to the photo's colour) */
  color: string;
}

const line = ({ product: p, size, qty, color }: BagItem) =>
  `• ${qty}x ${p.name} — Cor: ${color} — Tam. ${size} (ref. ${p.id.toUpperCase()})`;

export function whatsappUrl(items: BagItem[]): string {
  const text = [
    "Olá! Vim pelo site da allFit.",
    items.length === 1 ? "Tenho interesse nesta peça:" : "Tenho interesse nestas peças:",
    "",
    ...items.map(line),
    "",
    "Ver as peças com fotos:",
    bagShareUrl(items),
    "",
    "Pode me passar o valor e a disponibilidade?",
  ].join("\n");
  const number = STORE.whatsapp.replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function whatsappHelloUrl(): string {
  const number = STORE.whatsapp.replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent("Olá! Vim pelo site da allFit e queria tirar uma dúvida.")}`;
}

export function whatsappSizeHelpUrl(p: Product): string {
  const number = STORE.whatsapp.replace(/\D/g, "");
  const text = `Olá! Vim pelo site da allFit e tenho dúvida no tamanho do ${p.name} (${p.color}, ref. ${p.id.toUpperCase()}).`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
