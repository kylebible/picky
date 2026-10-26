import { z } from "zod";
import { CATEGORIES } from "./categories";

// The 14 major allergens recognised in EU/UK labelling law, plus sesame-style
// naming that US menus use. Keep this list closed so ranking can match on it.
export const ALLERGENS = [
  "celery",
  "gluten",
  "crustaceans",
  "egg",
  "fish",
  "lupin",
  "milk",
  "molluscs",
  "mustard",
  "tree_nuts",
  "peanuts",
  "sesame",
  "soy",
  "sulphites",
] as const;

const Source = z.enum(["stated", "likely"]);

export const DishSchema = z.object({
  name: z.string(),
  section: z.string().nullable(),
  // Picks the drawing the app shows for the dish.
  category: z.enum(CATEGORIES),
  // Price as printed, in the menu's currency. Null unless price_status is "listed".
  price: z.number().nullable(),
  price_status: z.enum(["listed", "market_price", "not_listed"]),
  description: z.string().nullable(),
  ingredients: z.array(z.object({ name: z.string(), source: Source })),
  allergens: z.array(z.object({ allergen: z.enum(ALLERGENS), source: Source })),
  diet_tags: z.array(z.string()),
  options: z.array(z.object({ name: z.string(), price_delta: z.number().nullable() })),
});

export const MenuSchema = z.object({
  restaurant_name: z.string().nullable(),
  currency: z.string().nullable(),
  dishes: z.array(DishSchema),
});

export type Dish = z.infer<typeof DishSchema>;
export type Menu = z.infer<typeof MenuSchema>;

export type ParsedMenuResponse = {
  menu: Menu;
  model: string;
  retried: boolean;
  usage: { input_tokens: number; output_tokens: number };
};
