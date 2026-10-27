import type { Dish } from "./menu";

// The order planner's estimate. It's a guess at what you'll pay, not a bill:
// dishes without a price are left out until you type one in, and a shared
// dish counts as half.

export type OrderItem = {
  dish: number;
  quantity: number;
  shared: boolean;
  /** How many people share it, counting you. Two when not set. */
  shareWith?: number;
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
  return (price * item.quantity) / (item.shared ? Math.max(2, item.shareWith ?? 2) : 1);
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

/**
 * Everyone's orders as one check. A shared dish is one plate on the check, so
 * it counts once at full price even when several people added it.
 */
export function combineOrders(orders: OrderItem[][]): OrderItem[] {
  const own = new Map<number, OrderItem>();
  const shared = new Map<number, OrderItem>();
  for (const item of orders.flat()) {
    if (item.shared) {
      const seen = shared.get(item.dish);
      shared.set(item.dish, {
        dish: item.dish,
        quantity: Math.max(seen?.quantity ?? 0, item.quantity),
        shared: false,
        price: seen?.price ?? item.price,
      });
    } else {
      const seen = own.get(item.dish);
      own.set(item.dish, {
        dish: item.dish,
        quantity: (seen?.quantity ?? 0) + item.quantity,
        shared: false,
        price: seen?.price ?? item.price,
      });
    }
  }
  return [...own.values(), ...shared.values()];
}
