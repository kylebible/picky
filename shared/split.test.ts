import { describe, expect, it } from "vitest";
import type { Dish } from "./menu";
import { almost, deckFor, eaterFrom, tableMatches, type Eater, type Member } from "./split";

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

const anyone: Eater = { allergies: [], diet: "anything", nopes: [], dislikes: [] };
const person = (id: string, extra: Partial<Eater> = {}): Member => ({
  ...anyone,
  ...extra,
  id,
  name: id,
  host: id === "a",
  sameCheck: false,
});

describe("deckFor", () => {
  const dishes = [
    dish("Burrata", { category: "cheese", allergens: [{ allergen: "milk", source: "stated" }] }),
    dish("Shrimp", { category: "shellfish", allergens: [{ allergen: "crustaceans", source: "likely" }] }),
    dish("Steak", { category: "steak" }),
    dish("House red", { category: "wine" }),
    dish("Carrot cake", { category: "cake", description: "With raisins and walnuts" }),
    dish("Mapo tofu", { category: "curry", diet_tags: ["spicy"] }),
  ];

  it("leaves out drinks", () => {
    expect(deckFor(dishes, anyone, [anyone])).toEqual(["0", "1", "2", "4", "5"]);
  });

  it("leaves out stated and likely allergens", () => {
    const me = { ...anyone, allergies: ["milk" as const, "crustaceans" as const] };
    expect(deckFor(dishes, me, [me])).toEqual(["2", "4", "5"]);
  });

  it("leaves out dishes that clash with the diet", () => {
    const me = { ...anyone, diet: "vegetarian" as const };
    expect(deckFor(dishes, me, [me])).toEqual(["0", "4", "5"]);
  });

  it("leaves out tastes marked nope and dislikes from notes", () => {
    const me = eaterFrom({
      allergies: [],
      diet: "anything",
      tastes: { spicy: "nope" },
      notes: "I can't stand raisins",
    });
    expect(deckFor(dishes, me, [me])).toEqual(["0", "1", "2"]);
  });

  it("with two people, drops a dish either one can't have from both decks", () => {
    const a = person("a");
    const b = person("b", { allergies: ["milk"] });
    expect(deckFor(dishes, a, [a, b])).toEqual(["1", "2", "4", "5"]);
    expect(deckFor(dishes, b, [a, b])).toEqual(["1", "2", "4", "5"]);
  });

  it("with three or more, shows a dish only to the people who can have it", () => {
    const a = person("a");
    const b = person("b", { allergies: ["milk"] });
    const c = person("c", { allergies: ["milk"], diet: "vegetarian" });
    // Burrata: only a can have it, so nobody to share with.
    expect(deckFor(dishes, a, [a, b, c])).toEqual(["1", "2", "4", "5"]);
    // Steak: a and b, not c.
    expect(deckFor(dishes, c, [a, b, c])).toEqual(["4", "5"]);
  });
});

describe("tableMatches", () => {
  const dishes = [dish("Steak", { category: "steak" }), dish("Salad", { category: "salad" })];

  it("matches when everyone who can have the dish likes it", () => {
    const members = [person("a"), person("b"), person("c", { diet: "vegetarian" })];
    const swipes = [
      { userId: "a", dishId: "0", liked: true },
      { userId: "b", dishId: "0", liked: true },
      { userId: "a", dishId: "1", liked: true },
      { userId: "b", dishId: "1", liked: true },
    ];
    // Steak doesn't wait for the vegetarian; the salad does.
    expect(tableMatches(dishes, members, swipes)).toEqual(["0"]);
  });
});

describe("almost", () => {
  it("lists what you liked and someone else passed", () => {
    const swipes = [
      { userId: "a", dishId: "1", liked: true },
      { userId: "b", dishId: "1", liked: false },
      { userId: "a", dishId: "2", liked: true },
      { userId: "b", dishId: "2", liked: true },
      { userId: "a", dishId: "3", liked: true },
    ];
    expect(almost(swipes, "a")).toEqual([{ dishId: "1", passedBy: ["b"] }]);
  });
});
