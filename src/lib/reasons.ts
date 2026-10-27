import { TASTE_LABEL, type Ranked } from "../../shared/rank";
import { ALLERGEN_LABEL } from "./format";

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** The warning shown on a row for the person's own allergens, or null. */
export function allergenWarning(r: Ranked): string | null {
  const stated = r.allergens.filter((a) => a.source === "stated").map((a) => ALLERGEN_LABEL[a.allergen]);
  const likely = r.allergens.filter((a) => a.source === "likely").map((a) => ALLERGEN_LABEL[a.allergen]);
  if (stated.length) return `Has ${stated.join(" and ")}`;
  if (likely.length) return `Might have ${likely.join(" and ")}, ask first`;
  return null;
}

/** Plain sentences on why a dish suits the person or not, best first. */
export function reasons(r: Ranked): { good: string[]; bad: string[] } {
  const good = [
    ...r.loves.map((t) => `You love ${lower(TASTE_LABEL[t])}.`),
    ...r.likedWords.map((w) => `You said you like ${w}.`),
  ];
  const bad = [
    ...(r.diet ? [`${r.diet}, which doesn't fit how you eat.`] : []),
    ...r.nopes.map((t) => `${TASTE_LABEL[t]} isn't your thing, and this has some.`),
    ...r.dislikedWords.map((w) => `You said no to ${w}.`),
  ];
  return { good, bad };
}

/** One short line for a row on For you. */
export function rowReason(r: Ranked): string | null {
  const { good, bad } = reasons(r);
  return (bad[0] ?? good[0] ?? null)?.replace(/\.$/, "") ?? null;
}
