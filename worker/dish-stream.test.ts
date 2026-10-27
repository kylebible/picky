import { describe, expect, it } from "vitest";
import type { Dish, Menu } from "../shared/menu";
import { DishStream } from "./dish-stream";

const dish = (name: string, description: string | null = null): Dish => ({
  name,
  section: "Mains",
  category: "other",
  price: 12.5,
  price_status: "listed",
  description,
  ingredients: [{ name: "garlic", source: "stated" }],
  allergens: [{ allergen: "milk", source: "likely" }],
  diet_tags: ["vegetarian"],
  sizes: [{ name: "Small", price: 12.5 }, { name: "Large", price: 15 }],
  add_ons: [{ name: "Add {extra} cheese [big]", price_delta: 2 }],
});

const menu: Menu = {
  restaurant_name: 'Luigi\'s "Best" Pizza',
  currency: "USD",
  dishes: [dish("Margherita", 'Tomato, "fior di latte", basil } ] {'), dish("Funghi"), dish("Crème brûlée")],
};

function feed(text: string, size: number) {
  const stream = new DishStream();
  const found: Dish[] = [];
  for (let i = 0; i < text.length; i += size) found.push(...stream.push(text.slice(i, i + size)));
  return { stream, found };
}

describe("DishStream", () => {
  it.each([1, 7, 1000])("finds every dish when text arrives %i characters at a time", (size) => {
    const { stream, found } = feed(JSON.stringify(menu, null, size === 7 ? 2 : undefined), size);
    expect(found).toEqual(menu.dishes);
    expect(stream.header).toEqual({ restaurant_name: menu.restaurant_name, currency: "USD" });
  });

  it("returns each dish as soon as it is complete", () => {
    const text = JSON.stringify(menu);
    const firstEnd = text.indexOf("Funghi") - '{"name":"'.length - 1;
    const stream = new DishStream();
    expect(stream.push(text.slice(0, firstEnd))).toEqual([menu.dishes[0]]);
    expect(stream.push(text.slice(firstEnd))).toEqual(menu.dishes.slice(1));
  });

  it("skips a dish that doesn't fit the schema", () => {
    const text = JSON.stringify({ ...menu, dishes: [{ name: "Broken" }, dish("Fine")] });
    expect(feed(text, 5).found.map((d) => d.name)).toEqual(["Fine"]);
  });
});
