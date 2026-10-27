import type { ALLERGENS } from "./menu";

// A person's eating profile. Kept on the phone until Google sign-in lands,
// then saved to the profiles table.

export type Allergen = (typeof ALLERGENS)[number];

export const DIETS = ["anything", "vegetarian", "vegan", "pescatarian", "halal", "kosher"] as const;
export type Diet = (typeof DIETS)[number];

export const TASTES = ["cheesy", "spicy", "mushrooms", "seafood", "cilantro", "sweet"] as const;
export type Taste = (typeof TASTES)[number];
export type Feeling = "love" | "fine" | "nope";

export type Profile = {
  allergies: Allergen[];
  diet: Diet;
  tastes: Partial<Record<Taste, Feeling>>;
  /** Free text such as "I can't stand raisins, love anything with lemon". */
  notes: string;
};

export const EMPTY_PROFILE: Profile = { allergies: [], diet: "anything", tastes: {}, notes: "" };
