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
  // "unreadable": a price is printed but the photo doesn't show it clearly.
  price_status: z.enum(["listed", "market_price", "not_listed", "unreadable"]),
  description: z.string().nullable(),
  ingredients: z.array(z.object({ name: z.string(), source: Source })),
  allergens: z.array(z.object({ allergen: z.enum(ALLERGENS), source: Source })),
  diet_tags: z.array(z.string()),
  // Every size with its own price, the default or smallest first; empty when there's one size.
  sizes: z.array(z.object({ name: z.string(), price: z.number().nullable() })),
  add_ons: z.array(z.object({ name: z.string(), price_delta: z.number().nullable() })),
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

/** Lines of the newline-delimited JSON that /api/parse-menu streams back. */
export type MenuStreamEvent =
  // The restaurant name and currency, once the first read has written them.
  | { type: "menu"; restaurant_name: string | null; currency: string | null }
  // A dish from the first read, sent as soon as it is complete, for the reading screen.
  | { type: "dish"; dish: Dish }
  // The quick reads disagreed, so a slower careful read has started.
  | { type: "checking" }
  // Sent every few seconds so phones don't drop a connection that looks idle.
  | { type: "ping" }
  | { type: "done"; result: ParsedMenuResponse }
  // `detail` is the technical reason, shown small under the message while Picky is in beta.
  | { type: "error"; message: string; detail?: string };

/**
 * Upgrades a menu saved before dishes had `sizes` and `add_ons` (they had
 * `options`), so menus kept on phones or shared at a table still load.
 */
export function normalizeMenu<T extends { dishes: unknown[] }>(menu: T): T {
  return {
    ...menu,
    dishes: menu.dishes.map((d) => {
      const dish = d as Record<string, unknown>;
      if (Array.isArray(dish.sizes) && Array.isArray(dish.add_ons)) return dish;
      const { options, ...rest } = dish;
      return { ...rest, sizes: dish.sizes ?? [], add_ons: dish.add_ons ?? options ?? [] };
    }),
  };
}
