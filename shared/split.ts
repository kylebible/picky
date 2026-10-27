import type { Category } from "./categories";
import type { Dish, Menu } from "./menu";
import { isMatch, type Swipe } from "./match";
import type { OrderItem } from "./order";
import type { Allergen, Diet, Profile, Taste } from "./profile";
import { dietConflict, matchesTaste, mentionsAny, parseNotes } from "./rank";

// Messages and pure helpers for Split it, shared by the Durable Object and the
// app. A table has the host, who read the menu, and up to MAX_PEOPLE - 1
// tablemates who join by QR code or table code without an account.

export const TABLE_CODE = /^\d{4}$/;
export const MAX_PEOPLE = 6;

/** What the table needs to know about how someone eats. */
export type Eater = {
  allergies: Allergen[];
  diet: Diet;
  /** Tastes they marked "not for me", such as spicy. */
  nopes: Taste[];
  /** Foods named as dislikes in their notes, such as raisins. */
  dislikes: string[];
};

export type Member = Eater & {
  id: string;
  name: string;
  host: boolean;
  /** On the table's shared check, so they see one total with the others on it. */
  sameCheck: boolean;
};

/** The parts of a profile a table sees. Notes stay on the phone; only the dislikes in them are sent. */
export function eaterFrom(profile: Pick<Profile, "allergies" | "diet" | "tastes" | "notes">): Eater {
  return {
    allergies: profile.allergies,
    diet: profile.diet,
    nopes: (Object.keys(profile.tastes) as Taste[]).filter((t) => profile.tastes[t] === "nope"),
    dislikes: parseNotes(profile.notes).dislikes,
  };
}

/** What the app sends to create a table. */
export type CreateTable = Eater & { menu: Menu; name: string };

/** What anyone with the code can see before joining. */
export type TableInfo = { hostName: string; restaurant: string | null; menu: Menu; full: boolean };

export type ClientMessage =
  | ({ type: "hello"; name: string } & Eater)
  | { type: "swipe"; dishId: string; liked: boolean }
  /** This phone's order, sent whenever it changes, for the shared check. */
  | { type: "order"; items: OrderItem[] }
  | { type: "check"; same: boolean };

export type ServerMessage =
  | {
      type: "state";
      you: string;
      members: Member[];
      swipes: Swipe[];
      matches: string[];
      /** Each person's order, by member id. */
      orders: Record<string, OrderItem[]>;
    }
  | { type: "match"; dishId: string }
  | { type: "error"; message: string };

const DRINKS: Category[] = ["coffee", "drink", "cocktail", "wine", "beer"];

/** Whether someone can have the dish: no allergen of theirs, no clash with how they eat, nothing they dislike. */
export function canHave(dish: Dish, person: Eater): boolean {
  if (dish.allergens.some((a) => person.allergies.includes(a.allergen))) return false;
  if (dietConflict(dish, person.diet) !== null) return false;
  if ((person.nopes ?? []).some((t) => matchesTaste(dish, t))) return false;
  return !mentionsAny(dish, person.dislikes ?? []);
}

/** The people at the table who can have the dish. */
export function eatersOf<T extends Eater>(dish: Dish, members: T[]): T[] {
  return members.filter((m) => canHave(dish, m));
}

/**
 * The dishes a person swipes on: food only, that they can have, and that
 * someone else at the table can share. With two people a dish anyone can't
 * have is gone for both; with more, it shows only to the people who can.
 */
export function deckFor(dishes: Dish[], person: Eater, members: Eater[]): string[] {
  const needed = Math.min(2, Math.max(1, members.length));
  return dishes
    .map((dish, i) => ({ dish, id: String(i) }))
    .filter(({ dish }) => !DRINKS.includes(dish.category))
    .filter(({ dish }) => canHave(dish, person) && eatersOf(dish, members).length >= needed)
    .map(({ id }) => id);
}

/** Dishes everyone who can have them has said yes to, in menu order. */
export function tableMatches(dishes: Dish[], members: Member[], swipes: Swipe[]): string[] {
  return dishes
    .map((dish, i) => ({ dish, id: String(i) }))
    .filter(({ dish }) => !DRINKS.includes(dish.category))
    .filter(({ dish, id }) =>
      isMatch(
        swipes,
        id,
        eatersOf(dish, members).map((m) => m.id),
      ),
    )
    .map(({ id }) => id);
}

/** Dishes you liked that someone else passed on, with who passed. */
export function almost(swipes: Swipe[], you: string): { dishId: string; passedBy: string[] }[] {
  return swipes
    .filter((s) => s.userId === you && s.liked)
    .map((s) => ({
      dishId: s.dishId,
      passedBy: swipes.filter((o) => o.dishId === s.dishId && o.userId !== you && !o.liked).map((o) => o.userId),
    }))
    .filter((a) => a.passedBy.length > 0);
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
