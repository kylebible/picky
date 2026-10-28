import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { Buffer } from "node:buffer";
import { MenuSchema, type Dish, type Menu, type MenuStreamEvent, type ParsedMenuResponse } from "../shared/menu";
import { DishStream } from "./dish-stream";

export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const SYSTEM_PROMPT = `You read photos of restaurant menus and return every dish as structured data.

Rules:
- Include every orderable item: starters, mains, sides, desserts and drinks. Skip headings, taglines and contact details.
- section is the menu heading the dish sits under.
- category: the closest kind of dish from the allowed list, judged from the dish itself rather than the section (a crab cake under Starters is shellfish). Use "other" only when nothing fits.
- price: the number printed for the dish, without the currency symbol. Copy each digit exactly as printed and never guess or round: if you can't make out every digit, use "unreadable". Calorie counts such as "(cal 910)" are not prices; the price is usually the number right after them. Set price_status to "listed" when a number is printed, "market_price" when the menu says MP, market price, seasonal price or ask your server, and "not_listed" when the menu shows no price for it, and "unreadable" when a price is printed but you can't make out the number. price is null unless price_status is "listed".
- ingredients: mark each one "stated" when the menu text names it, or "likely" when you infer it from the dish (for example garlic in garlic bread is stated, flour is likely).
- allergens: only from the allowed list, each marked "stated" or "likely" the same way. Prefer listing a likely allergen over leaving it out.
- diet_tags: short lowercase tags such as vegetarian, vegan, gluten-free, pescatarian, spicy, when the menu marks them or they clearly apply.
- sizes: when a dish lists several sizes with their own prices (for example "Big 6.29, Real Big 8.99", "cup / bowl", "6 pc / 12 pc", "glass / bottle"), list every size in printed order with its own full price, smallest first. price is then the smallest size's price. Leave sizes empty when the dish has one size.
- add_ons: extras, swaps and choices printed with the dish or its section (such as "Add chicken 3.79", "sub tofu", "choice of beef or shrimp +2"), with price_delta when an upcharge is printed, else null. A section-wide add-on ("Add chicken to any salad 3.79") goes on every dish in that section. An add-on's price never replaces the dish's own price.
- currency: ISO code inferred from symbols or location, or null if unclear.
- Copy names as printed. If a menu is not in English, keep the original name and translate the description into English.`;

export class MenuParseError extends Error {}

type Photo = { data: ArrayBuffer; type: ImageType };

export function toPhoto(file: File): Promise<Photo> {
  if (!IMAGE_TYPES.includes(file.type as ImageType)) {
    throw new MenuParseError(`Unsupported image type: ${file.type || "unknown"}`);
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new MenuParseError("Each photo must be 5 MB or smaller");
  }
  return file.arrayBuffer().then((data) => ({ data, type: file.type as ImageType }));
}

type Effort = "low" | "medium" | "high";

const norm = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").trim();

/** Edit-distance similarity from 0 to 1, for dish names that differ by a typo or accent. */
function similarity(a: string, b: string) {
  if (!a.length && !b.length) return 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

/** Pairs each dish in `ref` with at most one dish in `other`: exact names first, then close ones. */
function matchDishes(ref: Dish[], other: Dish[]): [Dish, Dish][] {
  const pairs: [Dish, Dish][] = [];
  const left = new Set(other.map((_, i) => i));
  const unmatched: Dish[] = [];
  const byName = new Map<string, number[]>();
  other.forEach((d, i) => byName.set(norm(d.name), [...(byName.get(norm(d.name)) ?? []), i]));
  for (const d of ref) {
    const j = byName.get(norm(d.name))?.find((i) => left.has(i));
    if (j === undefined) unmatched.push(d);
    else {
      left.delete(j);
      pairs.push([d, other[j]]);
    }
  }
  for (const d of unmatched) {
    let best = -1;
    let bestScore = 0.75;
    for (const j of left) {
      const score = similarity(norm(d.name), norm(other[j].name));
      if (score >= bestScore) [best, bestScore] = [j, score];
    }
    if (best >= 0) {
      left.delete(best);
      pairs.push([d, other[best]]);
    }
  }
  return pairs;
}

/**
 * Reasons two cheap reads of the same menu disagree, so a stronger model should
 * read it. Thresholds come from the real-menu tests: on 26 menus this sent about
 * 38% to the retry model and kept dish and price accuracy near the Opus read.
 */
export function disagreement(a: Menu | null, b: Menu | null): string[] {
  if (!a || !b) return ["a read failed"];
  const na = a.dishes.length;
  const nb = b.dishes.length;
  if (na === 0 && nb === 0) return ["no dishes found"];
  const why: string[] = [];
  if (Math.abs(na - nb) / Math.max(na, nb) > 0.1) why.push("dish counts differ");
  const pairs = matchDishes(b.dishes, a.dishes);
  if (pairs.length / Math.max(nb, 1) < 0.9) why.push("dish names differ");
  const priced = pairs.filter(([r]) => r.price_status === "listed" && r.price !== null);
  const pricesMatch = priced.filter(([r, c]) => c.price !== null && Math.abs(r.price! - c.price) < 0.01).length;
  if (priced.length && pricesMatch / priced.length < 0.9) why.push("prices differ");
  return why;
}

type Send = (event: MenuStreamEvent) => void;

/** Sends the menu's header and each finished dish from a read's text as it streams. */
function preview(send: Send) {
  const dishes = new DishStream();
  let sentHeader = false;
  return (text: string) => {
    const found = dishes.push(text);
    if (!sentHeader && dishes.header) {
      sentHeader = true;
      send({ type: "menu", ...dishes.header });
    }
    found.forEach((dish) => send({ type: "dish", dish }));
  };
}

/** Base64-encodes the photos once, since up to three reads send them. */
function toImages(photos: Photo[]) {
  return photos.map((p) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: p.type, data: Buffer.from(p.data).toString("base64") },
  }));
}

type Images = ReturnType<typeof toImages>;

async function readWith(
  client: Anthropic,
  model: string,
  effort: Effort,
  images: Images,
  withFallback: boolean,
  onText?: (text: string) => void,
) {
  // Streamed because a dense menu on the retry model can take minutes and tens of thousands of tokens.
  const stream = client.beta.messages.stream({
    model,
    max_tokens: 64000,
    system: SYSTEM_PROMPT,
    output_config: { effort, format: betaZodOutputFormat(MenuSchema) },
    ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    messages: [
      {
        role: "user",
        content: [
          ...images,
          { type: "text" as const, text: `These are ${images.length} page(s) of one menu. Return every dish.` },
        ],
      },
    ],
    });
  if (onText) stream.on("text", onText);
  const started = Date.now();
  const response = await stream.finalMessage().catch((err) => {
    // Output that was cut off or doesn't fit the schema counts as a failed read; API errors still throw.
    if (err instanceof Anthropic.APIError) throw err;
    return null;
  });
  const ms = Date.now() - started;
  if (!response) return { menu: null, usage: { input_tokens: 0, output_tokens: 0 }, ms, stop_reason: "invalid_output" };
  const menu = response.stop_reason === "end_turn" ? response.parsed_output : null;
  return { menu, usage: response.usage, ms, stop_reason: response.stop_reason };
}

type Read = Awaited<ReturnType<typeof readWith>>;

/** What each model read, kept in D1 (menu_reads) so scans can be reviewed later. Never includes photos. */
export type ReadTrace = {
  strong: boolean;
  pages: number;
  reasons: string[];
  reads: {
    role: "low" | "medium" | "careful";
    model: string;
    effort: Effort;
    ms: number;
    stop_reason: string | null;
    input_tokens: number;
    output_tokens: number;
    menu: Menu | null;
  }[];
};

export const newTrace = (): ReadTrace => ({ strong: false, pages: 0, reasons: [], reads: [] });

function note(trace: ReadTrace, role: ReadTrace["reads"][number]["role"], model: string, effort: Effort, read: Read) {
  const { input_tokens, output_tokens } = read.usage;
  trace.reads.push({ role, model, effort, ms: read.ms, stop_reason: read.stop_reason, input_tokens, output_tokens, menu: read.menu });
}

const readFailed = () => new MenuParseError("Couldn't read this menu. Try a sharper photo.");

/**
 * Reads the menu twice on MENU_MODEL (low and medium effort, in parallel) and
 * retries on MENU_RETRY_MODEL at high effort when the two reads disagree.
 * `strong` skips straight to the retry model, for when the person taps
 * "This looks wrong". `send` gets the first read's dishes as they arrive, and
 * a "checking" event when the careful read starts.
 */
export async function parseMenu(
  env: Env,
  photos: Photo[],
  strong = false,
  send: Send = () => {},
  trace: ReadTrace = newTrace(),
): Promise<ParsedMenuResponse> {
  if (photos.length === 0) throw new MenuParseError("Add at least one photo");
  if (photos.length > MAX_PHOTOS) throw new MenuParseError(`Up to ${MAX_PHOTOS} photos per menu`);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const images = toImages(photos);
  trace.strong = strong;
  trace.pages = photos.length;
  const usage = { input_tokens: 0, output_tokens: 0 };
  const add = (u: { input_tokens: number; output_tokens: number }) => {
    usage.input_tokens += u.input_tokens;
    usage.output_tokens += u.output_tokens;
  };

  if (strong) {
    const read = await readWith(client, env.MENU_RETRY_MODEL, "high", images, true, preview(send));
    add(read.usage);
    note(trace, "careful", env.MENU_RETRY_MODEL, "high", read);
    if (!read.menu) throw readFailed();
    return { menu: read.menu, model: env.MENU_RETRY_MODEL, retried: true, usage };
  }

  const [low, medium] = await Promise.all([
    // The low-effort read finishes first, so it fills the reading screen.
    readWith(client, env.MENU_MODEL, "low", images, false, preview(send)),
    readWith(client, env.MENU_MODEL, "medium", images, false),
  ]);
  add(low.usage);
  add(medium.usage);
  note(trace, "low", env.MENU_MODEL, "low", low);
  note(trace, "medium", env.MENU_MODEL, "medium", medium);
  const cheap = medium.menu ?? low.menu;

  const why = disagreement(low.menu, medium.menu);
  trace.reasons = why;
  console.log("menu quick reads", {
    low: low.menu?.dishes.length ?? null,
    medium: medium.menu?.dishes.length ?? null,
    retry: why,
  });
  if (why.length === 0) {
    return { menu: cheap!, model: env.MENU_MODEL, retried: false, usage };
  }

  send({ type: "checking" });
  const retry = await readWith(client, env.MENU_RETRY_MODEL, "high", images, true);
  add(retry.usage);
  note(trace, "careful", env.MENU_RETRY_MODEL, "high", retry);
  console.log("menu careful read", { dishes: retry.menu?.dishes.length ?? null });
  const menu = retry.menu ?? cheap;
  if (!menu) throw readFailed();
  return { menu, model: retry.menu ? env.MENU_RETRY_MODEL : env.MENU_MODEL, retried: true, usage };
}
