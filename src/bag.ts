import { useCallback, useEffect, useState } from "react";
import { products, type Product } from "./catalog";
import type { BagItem } from "./whatsapp";

const KEY = "allfit.bag.v1";
type Stored = { id: string; size: string; qty: number }[];

function load(): BagItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as Stored;
    return raw.flatMap((r) => {
      const product = products.find((p) => p.id === r.id);
      return product ? [{ product, size: r.size, qty: Math.max(1, Math.min(20, r.qty)) }] : [];
    });
  } catch {
    return [];
  }
}

export function useBag() {
  const [items, setItems] = useState<BagItem[]>(load);

  useEffect(() => {
    const data: Stored = items.map((i) => ({ id: i.product.id, size: i.size, qty: i.qty }));
    localStorage.setItem(KEY, JSON.stringify(data));
  }, [items]);

  const add = useCallback((product: Product, size: string, qty = 1) => {
    setItems((cur) => {
      const hit = cur.find((i) => i.product.id === product.id && i.size === size);
      if (hit) return cur.map((i) => (i === hit ? { ...i, qty: Math.min(20, i.qty + qty) } : i));
      return [...cur, { product, size, qty }];
    });
  }, []);

  const setQty = useCallback((index: number, qty: number) => {
    setItems((cur) => (qty <= 0 ? cur.filter((_, i) => i !== index) : cur.map((it, i) => (i === index ? { ...it, qty: Math.min(20, qty) } : it))));
  }, []);

  const remove = useCallback((index: number) => setItems((cur) => cur.filter((_, i) => i !== index)), []);
  const clear = useCallback(() => setItems([]), []);
  const count = items.reduce((n, i) => n + i.qty, 0);

  return { items, add, setQty, remove, clear, count };
}
