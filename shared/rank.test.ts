import { describe, expect, it } from "vitest";
import type { Dish } from "./menu";
import { EMPTY_PROFILE, type Profile } from "./profile";
import { dietConflict, parseNotes, rankMenu, scoreDish } from "./rank";

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
    sizes: [], add_ons: [],
    ...extra,
  };
}

const profile = (p: Partial<Profile>): Profile => ({ ...EMPTY_PROFILE, ...p });

describe("rankMenu", () => {
  const cacio = dish("Cacio e pepe", { category: "pasta", description: "Pecorino, black pepper" });
  const gnocchi = dish("Pesto gnocchi", {
    category: "pasta",
    description: "Basil, parmesan",
    allergens: [{ allergen: "tree_nuts", source: "likely" }],
  });
  const salad = dish("Green salad", { category: "salad" });
  const wine = dish("House red", { category: "wine" });

  it("puts loved dishes first", () => {
    const ranked = rankMenu([salad, cacio], profile({ tastes: { cheesy: "love" } }));
    expect(ranked.map((r) => r.dish.name)).toEqual(["Cacio e pepe", "Green salad"]);
    expect(ranked[0].loves).toEqual(["cheesy"]);
  });

  it("moves a likely allergen below everything else, even a loved dish", () => {
    const ranked = rankMenu([gnocchi, salad], profile({ allergies: ["tree_nuts"], tastes: { cheesy: "love" } }));
    expect(ranked.map((r) => r.dish.name)).toEqual(["Green salad", "Pesto gnocchi"]);
    expect(ranked[1].allergens).toEqual([{ allergen: "tree_nuts", source: "likely" }]);
  });

  it("puts stated allergens below likely ones", () => {
    const stated = dish("Nut tart", { allergens: [{ allergen: "tree_nuts", source: "stated" }] });
    const ranked = rankMenu([stated, gnocchi], profile({ allergies: ["tree_nuts"] }));
    expect(ranked.map((r) => r.dish.name)).toEqual(["Pesto gnocchi", "Nut tart"]);
  });

  it("never hides a dish, but leaves drinks out", () => {
    expect(rankMenu([cacio, gnocchi, wine], profile({ allergies: ["tree_nuts"] }))).toHaveLength(2);
  });

  it("keeps menu order when nothing differs", () => {
    expect(rankMenu([salad, cacio], EMPTY_PROFILE).map((r) => r.index)).toEqual([0, 1]);
  });
});

describe("dietConflict", () => {
  it("flags meat for vegetarians unless the menu tags the dish", () => {
    expect(dietConflict(dish("Bacon burger", { category: "burger" }), "vegetarian")).toBe("Has meat");
    expect(
      dietConflict(dish("Beyond burger", { category: "burger", diet_tags: ["vegetarian"] }), "vegetarian"),
    ).toBeNull();
  });

  it("lets pescatarians eat fish", () => {
    expect(dietConflict(dish("Branzino", { category: "fish" }), "pescatarian")).toBeNull();
  });

  it("flags dairy for vegans", () => {
    expect(dietConflict(dish("Burrata", { allergens: [{ allergen: "milk", source: "stated" }] }), "vegan")).toBe(
      "Might have dairy or egg",
    );
  });

  it("flags pork for halal and shellfish for kosher", () => {
    expect(dietConflict(dish("Carbonara", { description: "Guanciale, egg" }), "halal")).toBe("Has pork");
    expect(dietConflict(dish("Shrimp cocktail", { category: "shellfish" }), "kosher")).toBe("Has shellfish");
  });

  it("does not match words inside other words", () => {
    expect(dietConflict(dish("Hamachi crudo", { category: "sushi" }), "halal")).toBeNull();
  });
});

describe("parseNotes", () => {
  it("splits likes and dislikes", () => {
    expect(parseNotes("I can't stand raisins, love anything with lemon")).toEqual({
      likes: ["lemon"],
      dislikes: ["raisins", "raisin"],
    });
  });

  it("feeds into the score", () => {
    const p = profile({ notes: "hate olives" });
    expect(scoreDish(dish("Pizza", { description: "Olives, anchovy" }), 0, p).dislikedWords).toEqual(["olives"]);
  });
});
