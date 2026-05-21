/** API client + state stores. */

import { writable, get, derived } from "svelte/store";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface User { userId: string; email: string; name: string }
export interface Product {
  id: string;
  name: string;
  variants: Array<{ id: string; sku: string; name?: string; priceSatang: number }>;
}
export interface CartLine {
  variantId: string;
  productName: string;
  variantName?: string;
  qty: number;
  unitPriceSatang: number;
}

export const user = writable<User | null>(null);
export const cart = writable<CartLine[]>([]);

export const cartTotals = derived(cart, ($cart) => {
  const totalSatang = $cart.reduce((s, l) => s + l.qty * l.unitPriceSatang, 0);
  const subtotalSatang = Math.round(totalSatang / 1.07);
  const vatSatang = totalSatang - subtotalSatang;
  return { totalSatang, subtotalSatang, vatSatang, count: $cart.reduce((s, l) => s + l.qty, 0) };
});

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  async register(email: string, password: string, name: string) {
    const u = await req<User>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) });
    user.set({ userId: (u as any).id, email: u.email, name: u.name });
    return u;
  },
  async login(email: string, password: string) {
    const u = await req<User>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    user.set({ userId: (u as any).id, email: u.email, name: u.name });
    return u;
  },
  async logout() {
    await req("/api/auth/logout", { method: "POST" });
    user.set(null);
  },
  async me() {
    try {
      const u = await req<User>("/api/auth/me");
      user.set(u);
      return u;
    } catch {
      user.set(null);
      return null;
    }
  },
  async products(shopId: string): Promise<Product[]> {
    const r = await req<{ products: any[] }>(`/api/products?shopId=${shopId}`);
    return r.products as Product[];
  },
  async commitTx(input: any) {
    return req<{ id: string; invoiceNumber: string; totalSatang: number; vatSatang: number; subtotalSatang: number; committedAt: string }>(
      "/api/tx/commit",
      { method: "POST", body: JSON.stringify(input) },
    );
  },
};

export function addToCart(p: Product, variantIdx = 0) {
  const v = p.variants[variantIdx];
  cart.update((items) => {
    const existing = items.find((l) => l.variantId === v.id);
    if (existing) existing.qty += 1;
    else
      items.push({
        variantId: v.id,
        productName: p.name,
        variantName: v.name,
        qty: 1,
        unitPriceSatang: v.priceSatang,
      });
    return [...items];
  });
}

export function setQty(variantId: string, qty: number) {
  cart.update((items) => {
    const line = items.find((l) => l.variantId === variantId);
    if (!line) return items;
    line.qty = Math.max(0, qty);
    return items.filter((l) => l.qty > 0);
  });
}

export function clearCart() {
  cart.set([]);
}

export function getCart() {
  return get(cart);
}
