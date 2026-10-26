import type { ALLERGENS } from "../../shared/menu";

export function formatPrice(amount: number, currency: string | null) {
  const whole = Number.isInteger(amount);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency ?? "USD",
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // The model can return a currency code Intl doesn't know.
    return amount.toFixed(whole ? 0 : 2);
  }
}

export const ALLERGEN_LABEL: Record<(typeof ALLERGENS)[number], string> = {
  celery: "celery",
  gluten: "gluten",
  crustaceans: "shellfish",
  egg: "egg",
  fish: "fish",
  lupin: "lupin",
  milk: "milk",
  molluscs: "molluscs",
  mustard: "mustard",
  tree_nuts: "tree nuts",
  peanuts: "peanuts",
  sesame: "sesame",
  soy: "soy",
  sulphites: "sulphites",
};

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
