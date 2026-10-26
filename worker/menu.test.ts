import { describe, expect, it } from "vitest";
import type { Dish, Menu } from "../shared/menu";
import { needsRetry } from "./menu";

function dish(price_status: Dish["price_status"]): Dish {
  return {
    name: "Dish",
    section: null,
    category: "other",
    price: price_status === "listed" ? 10 : null,
    price_status,
    description: null,
    ingredients: [],
    allergens: [],
    diet_tags: [],
    options: [],
  };
}

const menu = (dishes: Dish[]): Menu => ({ restaurant_name: null, currency: "USD", dishes });

describe("needsRetry", () => {
  it("retries when parsing failed", () => {
    expect(needsRetry(null, 1)).toBe(true);
  });

  it("retries when there are very few dishes for the photos sent", () => {
    expect(needsRetry(menu([dish("listed"), dish("listed")]), 1)).toBe(true);
  });

  it("accepts a fully priced menu", () => {
    expect(needsRetry(menu(Array.from({ length: 8 }, () => dish("listed"))), 2)).toBe(false);
  });

  it("accepts a menu with no prices at all", () => {
    expect(needsRetry(menu(Array.from({ length: 5 }, () => dish("not_listed"))), 1)).toBe(false);
  });

  it("accepts market price items", () => {
    expect(needsRetry(menu([dish("listed"), dish("market_price"), dish("listed")]), 1)).toBe(false);
  });

  it("retries when most prices went missing on a priced menu", () => {
    const dishes = [dish("listed"), dish("not_listed"), dish("not_listed"), dish("not_listed")];
    expect(needsRetry(menu(dishes), 1)).toBe(true);
  });
});
