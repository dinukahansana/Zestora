import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';

const lineSchema = z.object({
  productSlug: z.string().min(1).max(80),
  sizeId: z.string().min(1).max(80),
  addOnIds: z.array(z.string().min(1).max(80)).max(30),
  quantity: z.number().int().min(1).max(10),
});
export type CartLine = z.infer<typeof lineSchema>;
const cartSchema = z.object({ items: z.array(lineSchema).max(40) });

export function lineKey(line: CartLine) {
  return JSON.stringify([line.productSlug, line.sizeId, [...line.addOnIds].sort()]);
}

interface Cart {
  items: CartLine[];
  add: (line: CartLine) => boolean;
  change: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  removePurchased: (lines: CartLine[]) => void;
}

export const useCart = create<Cart>()(persist(
  (set, get) => ({
    items: [],
    add: line => {
      const parsed = lineSchema.safeParse(line);
      if (!parsed.success) return false;
      const items = get().items;
      const key = lineKey(line);
      const item = items.find(value => lineKey(value) === key);
      if ((!item && items.length >= 40) || (item && item.quantity + line.quantity > 10)) return false;
      set({
        items: item ? items.map(value => lineKey(value) === key
          ? { ...value, quantity: value.quantity + line.quantity }
          : value) : [...items, parsed.data],
      });
      return true;
    },
    change: (key, quantity) => {
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return;
      set(state => ({ items: state.items.map(line => lineKey(line) === key ? { ...line, quantity } : line) }));
    },
    remove: key => set(state => ({ items: state.items.filter(line => lineKey(line) !== key) })),
    removePurchased: purchased => set(state => ({
      items: state.items.flatMap(line => {
        const quantity = line.quantity - (purchased.find(item => lineKey(item) === lineKey(line))?.quantity ?? 0);
        return quantity > 0 ? [{ ...line, quantity }] : [];
      }),
    })),
  }),
  {
    name: 'zestora.cart',
    version: 1,
    partialize: state => ({ items: state.items }),
    merge: (stored, current) => {
      const result = cartSchema.safeParse(stored);
      return { ...current, items: result.success ? result.data.items : [] };
    },
  },
));

export const quantities = Array.from({ length: 10 }, (_, index) => index + 1);
