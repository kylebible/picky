import { describe, expect, it } from "vitest";
import { normalizeMenu } from "./menu";

describe("normalizeMenu", () => {
  it("turns an old dish's options into add_ons with no sizes", () => {
    const old = { restaurant_name: null, currency: "USD", dishes: [{ name: "Salad", options: [{ name: "Add chicken", price_delta: 3.79 }] }] };
    expect(normalizeMenu(old).dishes[0]).toEqual({ name: "Salad", sizes: [], add_ons: [{ name: "Add chicken", price_delta: 3.79 }] });
  });

  it("leaves a current dish alone", () => {
    const dish = { name: "Salad", sizes: [{ name: "Big", price: 6.29 }], add_ons: [] };
    expect(normalizeMenu({ dishes: [dish] }).dishes[0]).toBe(dish);
  });
});
