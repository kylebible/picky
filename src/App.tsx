import { useState } from "react";
import type { Dish, ParsedMenuResponse } from "../shared/menu";

type State =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "done"; result: ParsedMenuResponse }
  | { status: "error"; message: string };

function formatPrice(dish: Dish, currency: string | null) {
  if (dish.price_status === "market_price") return "Market price";
  if (dish.price_status === "not_listed" || dish.price === null) return "No price on menu";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency ?? "USD" }).format(dish.price);
}

export function App() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function readMenu(files: FileList | null) {
    if (!files?.length) return;
    setState({ status: "reading" });
    const form = new FormData();
    for (const file of Array.from(files)) form.append("photos", file);
    try {
      const res = await fetch("/api/parse-menu", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong");
      setState({ status: "done", result: body });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <main>
      <h1>Picky</h1>
      <p className="tagline">Snap the menu, see what you'll love.</p>

      <label className="snap">
        {state.status === "reading" ? "Reading the menu..." : "Snap or pick menu photos"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          disabled={state.status === "reading"}
          onChange={(e) => readMenu(e.target.files)}
        />
      </label>

      {state.status === "error" && <p className="error">{state.message}</p>}

      {state.status === "done" && (
        <section>
          <h2>{state.result.menu.restaurant_name ?? "Menu"}</h2>
          <ul className="dishes">
            {state.result.menu.dishes.map((dish, i) => (
              <li key={i}>
                <div className="row">
                  <strong>{dish.name}</strong>
                  <span className={dish.price_status === "listed" ? "price" : "price muted"}>
                    {formatPrice(dish, state.result.menu.currency)}
                  </span>
                </div>
                {dish.description && <p>{dish.description}</p>}
                {dish.allergens.length > 0 && (
                  <p className="allergens">
                    {dish.allergens
                      .map((a) => (a.source === "stated" ? a.allergen : `${a.allergen}?`))
                      .join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="meta">
            Read by {state.result.model}
            {state.result.retried ? " (retried)" : ""}. Allergens marked ? are guesses, so check with your server.
          </p>
        </section>
      )}
    </main>
  );
}
