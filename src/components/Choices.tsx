import type { Dish } from "../../shared/menu";
import { capitalize, formatPrice } from "../lib/format";

export type Picked = { size?: string; addOns: string[] };

/** Size and add-on pickers for a dish. Shows nothing for a dish with neither. */
export function Choices({
  dish,
  currency,
  picked,
  onChange,
}: {
  dish: Dish;
  currency: string | null;
  picked: Picked;
  onChange: (picked: Picked) => void;
}) {
  const size = picked.size ?? dish.sizes[0]?.name;
  return (
    <>
      {dish.sizes.length > 0 && (
        <div className="choice-group" role="radiogroup" aria-label="Size">
          <div className="chip-label">Size</div>
          <div className="toggles">
            {dish.sizes.map((s) => (
              <button
                key={s.name}
                type="button"
                role="radio"
                className="toggle"
                aria-checked={size === s.name}
                aria-pressed={size === s.name}
                onClick={() => onChange({ ...picked, size: s.name })}
              >
                {capitalize(s.name)}
                {s.price !== null && <span className="choice-price">{formatPrice(s.price, currency)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      {dish.add_ons.length > 0 && (
        <div className="choice-group">
          <div className="chip-label">Add-ons and choices</div>
          <div className="toggles">
            {dish.add_ons.map((a) => {
              const on = picked.addOns.includes(a.name);
              return (
                <button
                  key={a.name}
                  type="button"
                  className="toggle"
                  aria-pressed={on}
                  onClick={() =>
                    onChange({
                      ...picked,
                      addOns: on ? picked.addOns.filter((n) => n !== a.name) : [...picked.addOns, a.name],
                    })
                  }
                >
                  {capitalize(a.name)}
                  {a.price_delta !== null && a.price_delta !== 0 && (
                    <span className="choice-price">
                      {a.price_delta > 0 ? "+" : "−"}
                      {formatPrice(Math.abs(a.price_delta), currency)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
