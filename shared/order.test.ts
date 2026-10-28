import { describe, expect, it } from "vitest";
import type { Dish } from "./menu";
import { combineOrders, estimate, itemPrice, lineTotal } from "./order";

function dish(price: number | null, price_status: Dish["price_status"] = "listed"): Dish {
  return {
    name: "Dish",
    section: null,
    category: "other",
    price,
    price_status,
    description: null,
    ingredients: [],
    allergens: [],
    diet_tags: [],
    sizes: [],
    add_ons: [],
  };
}

describe("estimate", () => {
  const dishes = [dish(19), dish(16), dish(null, "market_price"), dish(null, "not_listed")];

  it("counts shared dishes as half and adds tax and tip on the subtotal", () => {
    const e = estimate(
      [
        { dish: 0, quantity: 1, shared: false },
        { dish: 1, quantity: 1, shared: true },
      ],
      dishes,
      8.875,
      20,
    );
    expect(e).toEqual({ subtotal: 27, tax: 2.4, tip: 5.4, total: 34.8, unpriced: [] });
  });

  it("leaves market price and unlisted dishes out until a price is typed in", () => {
    const items = [
      { dish: 0, quantity: 2, shared: false },
      { dish: 2, quantity: 1, shared: false },
      { dish: 3, quantity: 1, shared: false },
    ];
    expect(estimate(items, dishes, 0, 0)).toMatchObject({ subtotal: 38, unpriced: [2, 3] });
    items[1] = { ...items[1], price: 32 } as (typeof items)[number];
    expect(estimate(items, dishes, 0, 0)).toMatchObject({ subtotal: 70, unpriced: [3] });
  });

  it("treats a blank or negative tax as zero", () => {
    expect(estimate([{ dish: 0, quantity: 1, shared: false }], dishes, NaN, -5).total).toBe(19);
  });
});

describe("lineTotal", () => {
  it("splits a dish shared by three people three ways", () => {
    expect(lineTotal({ dish: 0, quantity: 1, shared: true, shareWith: 3 }, dish(30))).toBe(10);
  });
});

describe("combineOrders", () => {
  it("adds up everyone's own dishes and counts a shared dish once at full price", () => {
    const kyle = [
      { dish: 0, quantity: 1, shared: false },
      { dish: 1, quantity: 1, shared: true },
    ];
    const sam = [
      { dish: 0, quantity: 1, shared: false },
      { dish: 1, quantity: 1, shared: true },
    ];
    expect(combineOrders([kyle, sam])).toMatchObject([
      { dish: 0, quantity: 2, shared: false },
      { dish: 1, quantity: 1, shared: false },
    ]);
    expect(estimate(combineOrders([kyle, sam]), [dish(19), dish(16)], 0, 0).subtotal).toBe(54);
  });

  it("keeps a typed-in price for a market price dish", () => {
    const items = combineOrders([
      [{ dish: 0, quantity: 1, shared: true, price: 40 }],
      [{ dish: 0, quantity: 1, shared: true }],
    ]);
    expect(items).toMatchObject([{ dish: 0, quantity: 1, shared: false, price: 40 }]);
  });
});

describe("itemPrice", () => {
  const pizza: Dish = {
    ...dish(14),
    sizes: [
      { name: "small", price: 14 },
      { name: "large", price: 20 },
      { name: "party", price: null },
    ],
    add_ons: [
      { name: "extra cheese", price_delta: 2 },
      { name: "chili oil", price_delta: null },
    ],
  };

  it("uses the smallest size when none is picked", () => {
    expect(itemPrice({ dish: 0, quantity: 1, shared: false }, pizza)).toBe(14);
  });

  it("uses the picked size's price and adds priced add-ons", () => {
    const item = { dish: 0, quantity: 1, shared: false, size: "large", addOns: ["extra cheese", "chili oil"] };
    expect(itemPrice(item, pizza)).toBe(22);
  });

  it("asks for a price when the picked size has none", () => {
    expect(itemPrice({ dish: 0, quantity: 1, shared: false, size: "party" }, pizza)).toBeNull();
    expect(itemPrice({ dish: 0, quantity: 1, shared: false, size: "party", price: 40 }, pizza)).toBe(40);
  });

  it("keeps lines with different choices apart on a shared check", () => {
    const lines = combineOrders([
      [{ dish: 0, quantity: 1, shared: false, size: "large" }],
      [{ dish: 0, quantity: 1, shared: false }],
    ]);
    expect(lines.map((l) => [l.size, l.quantity])).toEqual([
      ["large", 1],
      [undefined, 1],
    ]);
  });
});
