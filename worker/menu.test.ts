import { describe, expect, it } from "vitest";
import type { Dish, Menu } from "../shared/menu";
import { disagreement } from "./menu";

function dish(name: string, price: number | null = 10): Dish {
  const price_status: Dish["price_status"] = price === null ? "not_listed" : "listed";
  return {
    name,
    section: null,
    category: "other",
    price,
    price_status,
    description: null,
    ingredients: [],
    allergens: [],
    diet_tags: [],
    options: [],
  };
}

const menu = (dishes: Dish[]): Menu => ({ restaurant_name: null, currency: "USD", dishes });

const names = (n: number) => Array.from({ length: n }, (_, i) => `Dish number ${i + 1}`);
const read = (list: string[], price = (_: number) => 10 as number | null) =>
  menu(list.map((n, i) => dish(n, price(i))));

describe("disagreement", () => {
  it("retries when a read failed", () => {
    expect(disagreement(null, read(names(10)))).toEqual(["a read failed"]);
  });

  it("retries when neither read found any dishes", () => {
    expect(disagreement(read([]), read([]))).toEqual(["no dishes found"]);
  });

  it("accepts two reads that agree", () => {
    expect(disagreement(read(names(20)), read(names(20)))).toEqual([]);
  });

  it("matches names that differ in case, punctuation or a typo", () => {
    const a = read(["Crème brûlée", "Fish & chips", "Caesar salad"]);
    const b = read(["creme brulee", "Fish and chips", "Ceasar salad"]);
    expect(disagreement(a, b)).toEqual([]);
  });

  it("retries when one read lists far more dishes", () => {
    const why = disagreement(read(names(14)), read(names(157)));
    expect(why).toContain("dish counts differ");
    expect(why).toContain("dish names differ");
  });

  it("retries when prices differ", () => {
    const a = read(names(10), (i) => (i < 3 ? 99 : 10));
    expect(disagreement(a, read(names(10)))).toEqual(["prices differ"]);
  });

  it("accepts a menu with no prices", () => {
    const none = () => null;
    expect(disagreement(read(names(8), none), read(names(8), none))).toEqual([]);
  });
});
