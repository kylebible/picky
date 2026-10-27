import { describe, expect, it } from "vitest";
import type { Dish } from "./menu";
import { almost, deckFor } from "./split";

function dish(name: string, extra: Partial<Dish> = {}): Dish {
  return {
    name,
    section: null,
    category: "other",
    price: 10,
    price_status: "listed",
    description: null,
    ingredients: [],
    allergens: [],
    diet_tags: [],
    options: [],
    ...extra,
  };
}

describe("deckFor", () => {
  const dishes = [
    dish("Burrata", { category: "cheese", allergens: [{ allergen: "milk", source: "stated" }] }),
    dish("Shrimp", { category: "shellfish", allergens: [{ allergen: "crustaceans", source: "likely" }] }),
    dish("Steak", { category: "steak" }),
    dish("House red", { category: "wine" }),
  ];

  it("leaves out drinks", () => {
    expect(deckFor(dishes, { allergies: [], diet: "anything" })).toEqual(["0", "1", "2"]);
  });

  it("leaves out stated and likely allergens", () => {
    expect(deckFor(dishes, { allergies: ["milk", "crustaceans"], diet: "anything" })).toEqual(["2"]);
  });

  it("leaves out dishes that clash with the diet", () => {
    expect(deckFor(dishes, { allergies: [], diet: "vegetarian" })).toEqual(["0"]);
  });
});

describe("almost", () => {
  it("lists what you liked and they passed", () => {
    const swipes = [
      { userId: "a", dishId: "1", liked: true },
      { userId: "b", dishId: "1", liked: false },
      { userId: "a", dishId: "2", liked: true },
      { userId: "b", dishId: "2", liked: true },
      { userId: "a", dishId: "3", liked: true },
    ];
    expect(almost(swipes, "a", "b")).toEqual(["1"]);
  });
});
