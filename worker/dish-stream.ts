import { DishSchema, type Dish } from "../shared/menu";

/**
 * Pulls finished dishes out of a menu's JSON while the model is still writing
 * it. Feed it text as it streams; it returns each dish object once its closing
 * brace arrives, and the restaurant name and currency once the dish list starts.
 */
export class DishStream {
  private text = "";
  private pos = 0;
  private depth = 0;
  private inString = false;
  private escaped = false;
  private inDishes = false;
  private dishStart = -1;

  header: { restaurant_name: string | null; currency: string | null } | null = null;

  push(chunk: string): Dish[] {
    this.text += chunk;
    const dishes: Dish[] = [];
    for (; this.pos < this.text.length; this.pos++) {
      const ch = this.text[this.pos];
      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (ch === "\\") this.escaped = true;
        else if (ch === '"') this.inString = false;
        continue;
      }
      if (ch === '"') this.inString = true;
      else if (ch === "{" || ch === "[") {
        if (this.depth === 1 && ch === "[" && /"dishes"\s*:\s*$/.test(this.text.slice(0, this.pos))) {
          this.inDishes = true;
          this.readHeader();
        }
        if (this.inDishes && this.depth === 2 && ch === "{") this.dishStart = this.pos;
        this.depth++;
      } else if (ch === "}" || ch === "]") {
        this.depth--;
        if (this.inDishes && this.depth === 2 && ch === "}" && this.dishStart >= 0) {
          const dish = parseDish(this.text.slice(this.dishStart, this.pos + 1));
          if (dish) dishes.push(dish);
          this.dishStart = -1;
        }
        if (this.depth === 1) this.inDishes = false;
      }
    }
    return dishes;
  }

  /** Closes the object just before the dish list to read the fields written so far. */
  private readHeader() {
    try {
      const head = JSON.parse(this.text.slice(0, this.pos).replace(/,?\s*"dishes"\s*:\s*$/, "}"));
      this.header = {
        restaurant_name: typeof head.restaurant_name === "string" ? head.restaurant_name : null,
        currency: typeof head.currency === "string" ? head.currency : null,
      };
    } catch {
      this.header = { restaurant_name: null, currency: null };
    }
  }
}

function parseDish(json: string): Dish | null {
  try {
    const parsed = DishSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
