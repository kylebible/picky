import type { Category } from "./categories";
import type { Dish, Menu } from "./menu";
import type { Allergen, Diet } from "./profile";
import { dietConflict } from "./rank";
import type { Swipe } from "./match";

// Messages and pure helpers for Split it, shared by the Durable Object and the
// app. A table has two people: the host, who read the menu, and a tablemate
// who joins by QR code or table code without an account.

export const TABLE_CODE = /^\d{4}$/;

export type Member = { id: string; name: string; allergies: Allergen[]; diet: Diet; host: boolean };

/** What the app sends to create a table. */
export type CreateTable = { menu: Menu; name: string; allergies: Allergen[]; diet: Diet };

/** What anyone with the code can see before joining. */
export type TableInfo = { hostName: string; restaurant: string | null; menu: Menu; full: boolean };

export type ClientMessage =
  | { type: "hello"; name: string; allergies: Allergen[]; diet: Diet }
  | { type: "swipe"; dishId: string; liked: boolean };

export type ServerMessage =
  | { type: "state"; you: string; members: Member[]; swipes: Swipe[]; matches: string[] }
  | { type: "match"; dishId: string }
  | { type: "error"; message: string };

const DRINKS: Category[] = ["coffee", "drink", "cocktail", "wine", "beer"];

/**
 * The dishes a person swipes on: food only, without anything that has or
 * might have one of their allergens, or that clashes with how they eat.
 */
export function deckFor(dishes: Dish[], person: Pick<Member, "allergies" | "diet">): string[] {
  return dishes
    .map((dish, i) => ({ dish, id: String(i) }))
    .filter(({ dish }) => !DRINKS.includes(dish.category))
    .filter(({ dish }) => !dish.allergens.some((a) => person.allergies.includes(a.allergen)))
    .filter(({ dish }) => dietConflict(dish, person.diet) === null)
    .map(({ id }) => id);
}

/** Dishes you liked that the other person has passed on. */
export function almost(swipes: Swipe[], you: string, them: string): string[] {
  const passed = new Set(swipes.filter((s) => s.userId === them && !s.liked).map((s) => s.dishId));
  return swipes.filter((s) => s.userId === you && s.liked && passed.has(s.dishId)).map((s) => s.dishId);
}

/** Quick allergy choices for a tablemate, as on the join screen. */
export const QUICK_ALLERGIES: { label: string; allergens: Allergen[]; diet?: Diet }[] = [
  { label: "Nuts", allergens: ["peanuts", "tree_nuts"] },
  { label: "Shellfish", allergens: ["crustaceans", "molluscs"] },
  { label: "Dairy", allergens: ["milk"] },
  { label: "Gluten", allergens: ["gluten"] },
  { label: "No meat", allergens: [], diet: "vegetarian" },
  { label: "Eggs", allergens: ["egg"] },
  { label: "Fish", allergens: ["fish"] },
  { label: "Soy", allergens: ["soy"] },
  { label: "Sesame", allergens: ["sesame"] },
];
