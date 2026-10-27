import { useSyncExternalStore } from "react";
import type { OrderItem } from "../../shared/order";

// The order planner for the current menu. Tax and tip stay put between menus,
// since they rarely change; the dishes are cleared when a new menu is read.

type State = { items: OrderItem[]; taxPercent: string; tipPercent: number };

const KEY = "picky.order";
const listeners = new Set<() => void>();

function load(): State {
  const fallback: State = { items: [], taxPercent: "", tipPercent: 20 };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

let state = load();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Blocked storage: the order still works until the page reloads.
  }
  listeners.forEach((l) => l());
}

/** For the table connection, which sends this order to a shared check. */
export function watchOrder(listener: (items: OrderItem[]) => void) {
  const l = () => listener(state.items);
  listeners.add(l);
  return () => listeners.delete(l);
}

export const orderItems = () => state.items;

export function useOrder() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function addToOrder(dish: number, { shared = false, shareWith }: { shared?: boolean; shareWith?: number } = {}) {
  const existing = state.items.find((i) => i.dish === dish);
  if (existing) return updateItem(dish, { quantity: existing.quantity + 1 });
  set({ items: [...state.items, { dish, quantity: 1, shared, ...(shared && shareWith ? { shareWith } : {}) }] });
}

export function updateItem(dish: number, patch: Partial<OrderItem>) {
  set({
    items: state.items.map((i) => (i.dish === dish ? { ...i, ...patch } : i)).filter((i) => i.quantity > 0),
  });
}

export const setTax = (taxPercent: string) => set({ taxPercent });
export const setTip = (tipPercent: number) => set({ tipPercent });

/** Points order items at new dish indexes after a re-read; -1 drops the item. */
export function remapOrderItems(newIndex: (oldIndex: number) => number) {
  set({ items: state.items.map((i) => ({ ...i, dish: newIndex(i.dish) })).filter((i) => i.dish >= 0) });
}

/** Number of dishes in the order, counting quantities. */
export const orderCount = (items: OrderItem[]) => items.reduce((n, i) => n + i.quantity, 0);
