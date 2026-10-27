import type { Dish } from "./menu";

// The order planner's estimate. It's a guess at what you'll pay, not a bill:
// dishes without a price are left out until you type one in, and a shared
// dish counts as half.

export type OrderItem = {
  dish: number;
  quantity: number;
  shared: boolean;
  /** A price the person typed in for a market-price or unpriced dish. */
  price?: number;
};

export type Estimate = {
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  /** Dishes left out of the total because they have no price yet. */
  unpriced: number[];
};

export function itemPrice(item: OrderItem, dish: Dish): number | null {
  if (dish.price_status === "listed" && dish.price !== null) return dish.price;
  return item.price ?? null;
}

/** What this line adds to the person's total, or null when it has no price. */
export function lineTotal(item: OrderItem, dish: Dish): number | null {
  const price = itemPrice(item, dish);
  if (price === null) return null;
  return price * item.quantity * (item.shared ? 0.5 : 1);
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Tip is worked out on the subtotal before tax, as most people tip. */
export function estimate(items: OrderItem[], dishes: Dish[], taxPercent: number, tipPercent: number): Estimate {
  let subtotal = 0;
  const unpriced: number[] = [];
  for (const item of items) {
    const dish = dishes[item.dish];
    if (!dish) continue;
    const line = lineTotal(item, dish);
    if (line === null) unpriced.push(item.dish);
    else subtotal += line;
  }
  const tax = (subtotal * Math.max(0, taxPercent || 0)) / 100;
  const tip = (subtotal * Math.max(0, tipPercent || 0)) / 100;
  return { subtotal: round(subtotal), tax: round(tax), tip: round(tip), total: round(subtotal + tax + tip), unpriced };
}
