import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { Buffer } from "node:buffer";
import { MenuSchema, type Menu, type ParsedMenuResponse } from "../shared/menu";

export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const SYSTEM_PROMPT = `You read photos of restaurant menus and return every dish as structured data.

Rules:
- Include every orderable item: starters, mains, sides, desserts and drinks. Skip headings, taglines and contact details.
- section is the menu heading the dish sits under.
- price: the number printed for the dish, without the currency symbol. Set price_status to "listed" when a number is printed, "market_price" when the menu says MP, market price, seasonal price or ask your server, and "not_listed" when the menu shows no price for it. price is null unless price_status is "listed".
- ingredients: mark each one "stated" when the menu text names it, or "likely" when you infer it from the dish (for example garlic in garlic bread is stated, flour is likely).
- allergens: only from the allowed list, each marked "stated" or "likely" the same way. Prefer listing a likely allergen over leaving it out.
- diet_tags: short lowercase tags such as vegetarian, vegan, gluten-free, pescatarian, spicy, when the menu marks them or they clearly apply.
- options: add-ons and choices printed with the dish, with price_delta when an upcharge is printed.
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

/** Signs that a cheap model misread the menu and a stronger one should try. */
export function needsRetry(menu: Menu | null, photoCount: number): boolean {
  if (!menu) return true;
  if (menu.dishes.length < 3 * photoCount) return true;
  const listed = menu.dishes.filter((d) => d.price_status === "listed").length;
  const unlisted = menu.dishes.filter((d) => d.price_status === "not_listed").length;
  // A menu that prices some dishes but "loses" most others was probably misread.
  return listed > 0 && unlisted > menu.dishes.length / 2;
}

async function readWith(
  client: Anthropic,
  model: string,
  photos: Photo[],
  withFallback: boolean,
) {
  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: { effort: "low", format: betaZodOutputFormat(MenuSchema) },
    ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    messages: [
      {
        role: "user",
        content: [
          ...photos.map((p) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: p.type,
              data: Buffer.from(p.data).toString("base64"),
            },
          })),
          { type: "text" as const, text: `These are ${photos.length} page(s) of one menu. Return every dish.` },
        ],
      },
    ],
  });
  const menu = response.stop_reason === "refusal" ? null : response.parsed_output;
  return { menu, usage: response.usage };
}

export async function parseMenu(env: Env, photos: Photo[]): Promise<ParsedMenuResponse> {
  if (photos.length === 0) throw new MenuParseError("Add at least one photo");
  if (photos.length > MAX_PHOTOS) throw new MenuParseError(`Up to ${MAX_PHOTOS} photos per menu`);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const first = await readWith(client, env.MENU_MODEL, photos, false);
  const usage = { input_tokens: first.usage.input_tokens, output_tokens: first.usage.output_tokens };

  if (!needsRetry(first.menu, photos.length)) {
    return { menu: first.menu!, model: env.MENU_MODEL, retried: false, usage };
  }

  const second = await readWith(client, env.MENU_RETRY_MODEL, photos, true);
  usage.input_tokens += second.usage.input_tokens;
  usage.output_tokens += second.usage.output_tokens;
  const menu = second.menu ?? first.menu;
  if (!menu) throw new MenuParseError("Couldn't read this menu. Try a sharper photo.");
  return { menu, model: second.menu ? env.MENU_RETRY_MODEL : env.MENU_MODEL, retried: true, usage };
}
