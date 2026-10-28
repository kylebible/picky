import type { Dish } from "./menu";

// The order planner's estimate. It's a guess at what you'll pay, not a bill:
// dishes without a price are left out until you type one in, and a shared
// dish counts as half.

export type OrderItem = {
  /** Tells apart two lines of the same dish with different choices. Older saved orders don't have one. */
  id?: string;
  dish: number;
  quantity: number;
  shared: boolean;
  /** How many people share it, counting you. Two when not set. */
  shareWith?: number;
  /** A price the person typed in for a market-price or unpriced dish. */
  price?: number;
  /** One of the dish's sizes, by name. Not set means the first (smallest) size. */
  size?: string;
  /** Add-ons picked from the dish's list, by name. */
  addOns?: string[];
};

export const lineId = (item: OrderItem) => item.id ?? String(item.dish);

/** The size and add-ons as one key, so lines with the same choices can be merged. */
export const choicesKey = (item: Pick<OrderItem, "size" | "addOns">) =>
  [item.size ?? "", ...[...(item.addOns ?? [])].sort()].join("|");

/** "Large, extra cheese", or "" when nothing was picked. */
export const choicesLabel = (item: Pick<OrderItem, "size" | "addOns">) =>
  [item.size, ...(item.addOns ?? [])].filter(Boolean).join(", ");

export type Estimate = {
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  /** Dishes left out of the total because they have no price yet. */
  unpriced: number[];
};

/** One of this line's dishes with its size and add-ons, or null when there's no price. */
export function itemPrice(item: OrderItem, dish: Dish): number | null {
  const size = item.size ? dish.sizes.find((s) => s.name === item.size) : undefined;
  const listed = size ? size.price : dish.price_status === "listed" ? dish.price : null;
  const base = listed ?? item.price ?? null;
  if (base === null) return null;
  const extras = (item.addOns ?? []).reduce(
    (sum, name) => sum + (dish.add_ons.find((a) => a.name === name)?.price_delta ?? 0),
    0,
  );
  return base + extras;
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
  const lines = new Map<string, OrderItem>();
  for (const item of orders.flat()) {
    const key = `${item.shared ? "shared" : "own"}:${item.dish}:${choicesKey(item)}`;
    const seen = lines.get(key);
    lines.set(key, {
      id: key,
      dish: item.dish,
      quantity: !seen
        ? item.quantity
        : item.shared
          ? Math.max(seen.quantity, item.quantity)
          : seen.quantity + item.quantity,
      shared: false,
      price: seen?.price ?? item.price,
      ...(item.size ? { size: item.size } : {}),
      ...(item.addOns?.length ? { addOns: item.addOns } : {}),
    });
  }
  return [...lines.values()];
}
