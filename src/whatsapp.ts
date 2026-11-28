import { STORE, money, unitPrice, cashPrice, isPlus } from "./config";
import type { Product } from "./catalog";
import { bagShareUrl } from "./share";

/** line total for one bag item (Plus Size fee included) */
export const itemTotal = (i: { product: Product; size: string; qty: number }) => unitPrice(i.product.price, i.size) * i.qty;
export const bagTotal = (items: { product: Product; size: string; qty: number }[]) => items.reduce((n, i) => n + itemTotal(i), 0);

export interface BagItem {
  product: Product;
  size: string;
  qty: number;
  /** colour the customer chose from the store palette (defaults to the photo's colour) */
  color: string;
}

const line = (i: BagItem) =>
  `• ${i.qty}x ${i.product.name} — Cor: ${i.color} — Tam. ${i.size}${isPlus(i.size) ? " (Plus Size)" : ""} — ${money(itemTotal(i))} (ref. ${i.product.id.toUpperCase()})`;

export function whatsappUrl(items: BagItem[]): string {
  const total = bagTotal(items);
  const text = [
    "Olá! Vim pelo site da allFit.",
    items.length === 1 ? "Quero esta peça:" : "Quero estas peças:",
    "",
    ...items.map(line),
    "",
    `Total: ${money(total)}`,
    `À vista (${Math.round(STORE.cashDiscount * 100)}% de desconto): ${money(cashPrice(total))}`,
    "",
    "Ver as peças com fotos:",
    bagShareUrl(items),
    "",
    "Pode confirmar a disponibilidade?",
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
