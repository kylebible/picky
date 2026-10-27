import { CATEGORY_GROUP, type Category } from "./categories";
import type { Dish } from "./menu";
import type { Allergen, Profile, Taste } from "./profile";

// Deterministic ranking of a menu against a profile. Dishes that might hold
// one of the person's allergens are moved to the bottom and flagged, never
// hidden: the menu read can be wrong in either direction.

const DRINKS: Category[] = ["coffee", "drink", "cocktail", "wine", "beer"];

const WORDS = {
  cheese: [
    "cheese",
    "cheesy",
    "parmesan",
    "parmigiano",
    "mozzarella",
    "burrata",
    "pecorino",
    "cheddar",
    "ricotta",
    "feta",
    "gouda",
    "brie",
    "queso",
    "paneer",
    "gruyere",
    "gruyère",
    "cacio",
    "halloumi",
    "mascarpone",
    "gorgonzola",
    "provolone",
    "manchego",
    "fontina",
    "taleggio",
    "stracciatella",
    "raclette",
  ],
  spicy: [
    "spicy",
    "chili",
    "chile",
    "chilli",
    "jalapeño",
    "jalapeno",
    "sriracha",
    "nduja",
    "'nduja",
    "harissa",
    "gochujang",
    "habanero",
    "chipotle",
    "szechuan",
    "sichuan",
    "arrabbiata",
    "diavola",
    "vindaloo",
    "peri peri",
    "piri piri",
    "buffalo",
    "hot sauce",
    "sambal",
    "scotch bonnet",
    "cayenne",
  ],
  mushrooms: [
    "mushroom",
    "mushrooms",
    "porcini",
    "truffle",
    "shiitake",
    "chanterelle",
    "chanterelles",
    "morel",
    "morels",
    "portobello",
    "funghi",
    "enoki",
    "oyster mushroom",
    "cremini",
    "maitake",
  ],
  cilantro: ["cilantro", "coriander"],
  meat: [
    "beef",
    "pork",
    "chicken",
    "lamb",
    "bacon",
    "ham",
    "sausage",
    "prosciutto",
    "duck",
    "veal",
    "chorizo",
    "pancetta",
    "turkey",
    "steak",
    "salami",
    "guanciale",
    "mortadella",
    "brisket",
    "meatball",
    "meatballs",
    "ribs",
    "goat",
    "venison",
    "rabbit",
    "nduja",
    "'nduja",
    "oxtail",
    "liver",
    "pastrami",
    "pepperoni",
    "carnitas",
    "barbacoa",
    "al pastor",
  ],
  pork: [
    "pork",
    "bacon",
    "ham",
    "prosciutto",
    "pancetta",
    "chorizo",
    "salami",
    "guanciale",
    "mortadella",
    "lard",
    "nduja",
    "'nduja",
    "pepperoni",
    "carnitas",
    "al pastor",
    "speck",
    "char siu",
  ],
};

const MEAT_CATEGORIES: Category[] = ["steak", "chicken", "meat"];
const SEAFOOD_ALLERGENS: Allergen[] = ["fish", "crustaceans", "molluscs"];

export const TASTE_LABEL: Record<Taste, string> = {
  cheesy: "Cheesy things",
  spicy: "Spicy food",
  mushrooms: "Mushrooms",
  seafood: "Seafood",
  cilantro: "Cilantro",
  sweet: "Sweet stuff",
};

/** All the dish's words, lowercased, for keyword matching. */
function dishText(dish: Dish) {
  return [dish.name, dish.description ?? "", ...dish.ingredients.map((i) => i.name), ...dish.options.map((o) => o.name)]
    .join(" ")
    .toLowerCase();
}

function mentions(text: string, words: string[]) {
  return words.some((w) =>
    new RegExp(`(^|[^a-zà-ÿ'])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-zà-ÿ]|$)`).test(text),
  );
}

const hasTag = (dish: Dish, ...tags: string[]) => dish.diet_tags.some((t) => tags.includes(t.toLowerCase()));

export function matchesTaste(dish: Dish, taste: Taste, text = dishText(dish)): boolean {
  switch (taste) {
    case "cheesy":
      return dish.category === "cheese" || mentions(text, WORDS.cheese);
    case "spicy":
      return hasTag(dish, "spicy", "hot") || mentions(text, WORDS.spicy);
    case "mushrooms":
      return mentions(text, WORDS.mushrooms);
    case "seafood":
      return (
        CATEGORY_GROUP[dish.category] === "seafood" ||
        dish.allergens.some((a) => SEAFOOD_ALLERGENS.includes(a.allergen) && a.source === "stated")
      );
    case "cilantro":
      return mentions(text, WORDS.cilantro);
    case "sweet":
      return CATEGORY_GROUP[dish.category] === "sweet" && !DRINKS.includes(dish.category);
  }
}

/** Why the dish doesn't fit the diet, or null when it does (as far as we can tell). */
export function dietConflict(dish: Dish, diet: Profile["diet"], text = dishText(dish)): string | null {
  const meat = MEAT_CATEGORIES.includes(dish.category) || mentions(text, WORDS.meat);
  const seafood =
    CATEGORY_GROUP[dish.category] === "seafood" || dish.allergens.some((a) => SEAFOOD_ALLERGENS.includes(a.allergen));
  switch (diet) {
    case "anything":
      return null;
    case "vegetarian":
      if (hasTag(dish, "vegetarian", "vegan")) return null;
      return meat ? "Has meat" : seafood ? "Has seafood" : null;
    case "vegan":
      if (hasTag(dish, "vegan")) return null;
      if (meat) return "Has meat";
      if (seafood) return "Has seafood";
      if (dish.allergens.some((a) => a.allergen === "milk" || a.allergen === "egg")) return "Might have dairy or egg";
      return null;
    case "pescatarian":
      return meat && !hasTag(dish, "vegetarian", "vegan", "pescatarian") ? "Has meat" : null;
    case "halal":
      return mentions(text, WORDS.pork) ? "Has pork" : null;
    case "kosher":
      if (mentions(text, WORDS.pork)) return "Has pork";
      return dish.category === "shellfish" ||
        dish.allergens.some((a) => a.allergen === "crustaceans" || a.allergen === "molluscs")
        ? "Has shellfish"
        : null;
  }
}

const STOP = new Set([
  "i",
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "with",
  "anything",
  "things",
  "stuff",
  "food",
  "really",
  "very",
  "so",
  "much",
  "too",
  "just",
  "any",
  "all",
  "is",
  "are",
  "it",
  "in",
  "on",
  "my",
  "me",
  "but",
]);
const POSITIVE = /\b(love|loves|like|likes|into|adore|enjoy|fan of|crave|favou?rite)\b/;
const NEGATIVE =
  /\b(can'?t stand|cannot stand|hate|dislike|don'?t like|do not like|no|not|avoid|never|without|gross|ew)\b/;

/** Splits free-text notes into foods the person likes and dislikes. */
export function parseNotes(notes: string): { likes: string[]; dislikes: string[] } {
  const likes: string[] = [];
  const dislikes: string[] = [];
  for (const phrase of notes.toLowerCase().split(/[,;.\n]|\bbut\b/)) {
    const negative = NEGATIVE.test(phrase);
    const positive = !negative && POSITIVE.test(phrase);
    if (!negative && !positive) continue;
    const words = phrase
      .replace(NEGATIVE, " ")
      .replace(POSITIVE, " ")
      .split(/[^a-zà-ÿ']+/)
      .filter((w) => w.length > 2 && !STOP.has(w));
    // Also try singular forms, so "raisins" catches "raisin".
    const forms = words.flatMap((w) => (w.endsWith("s") && w.length > 4 ? [w, w.slice(0, -1)] : [w]));
    (negative ? dislikes : likes).push(...forms);
  }
  return { likes, dislikes };
}

export type AllergenHit = { allergen: Allergen; source: "stated" | "likely" };

export type Ranked = {
  index: number;
  dish: Dish;
  score: number;
  /** The person's allergens this dish has or might have. */
  allergens: AllergenHit[];
  diet: string | null;
  loves: Taste[];
  nopes: Taste[];
  likedWords: string[];
  dislikedWords: string[];
};

export function scoreDish(dish: Dish, index: number, profile: Profile): Ranked {
  const text = dishText(dish);
  const allergens = dish.allergens.filter((a) => profile.allergies.includes(a.allergen));
  const loves: Taste[] = [];
  const nopes: Taste[] = [];
  for (const [taste, feeling] of Object.entries(profile.tastes) as [Taste, string][]) {
    if (feeling === "fine" || !matchesTaste(dish, taste, text)) continue;
    (feeling === "love" ? loves : nopes).push(taste);
  }
  const notes = parseNotes(profile.notes);
  const likedWords = notes.likes.filter((w) => mentions(text, [w]));
  const dislikedWords = notes.dislikes.filter((w) => mentions(text, [w]));
  const diet = dietConflict(dish, profile.diet, text);

  let score = 3 * loves.length - 4 * nopes.length + 2 * likedWords.length - 3 * dislikedWords.length;
  if (diet) score -= 6;
  return { index, dish, score, allergens, diet, loves, nopes, likedWords, dislikedWords };
}

/** Ranks food (not drinks) for the person. Allergen dishes always come last. */
export function rankMenu(dishes: Dish[], profile: Profile): Ranked[] {
  return dishes
    .map((d, i) => scoreDish(d, i, profile))
    .filter((r) => !DRINKS.includes(r.dish.category))
    .sort((a, b) => {
      const risk = (r: Ranked) => (r.allergens.some((x) => x.source === "stated") ? 2 : r.allergens.length ? 1 : 0);
      return risk(a) - risk(b) || b.score - a.score || a.index - b.index;
    });
}
