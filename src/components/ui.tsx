import { useEffect } from "react";
import type { Dish } from "../../shared/menu";
import { formatPrice } from "../lib/format";
import { navigate } from "../lib/router";

export function Wordmark({ large = false }: { large?: boolean }) {
  return (
    <div className={large ? "wordmark large" : "wordmark"} aria-label="Picky" role="img">
      p
      <span className="i">
        ı<span className="dot" />
      </span>
      cky
    </div>
  );
}

const icon = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const BackIcon = () => (
  <svg {...icon}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
export const CloseIcon = () => (
  <svg {...icon}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const FlashIcon = () => (
  <svg {...icon} strokeWidth={2}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
);
export const WarnIcon = ({ size = 12 }: { size?: number }) => (
  <svg {...icon} width={size} height={size} stroke="#7A3A00" strokeWidth={2.6}>
    <path d="M12 3 2 21h20L12 3z" />
    <path d="M12 10v5" />
    {size > 14 && <path d="M12 18h.01" />}
  </svg>
);

/** Round back button. Goes back in history when there is some, else to `fallback`. */
export function BackButton({ fallback, label = "Back" }: { fallback: string; label?: string }) {
  return (
    <button
      type="button"
      className="round-btn"
      aria-label={label}
      onClick={() => (history.state?.picky ? history.back() : navigate(fallback, { replace: true }))}
    >
      <BackIcon />
    </button>
  );
}

/** The price cell at the end of a dish row: a price, an MP tag, or "No price listed". */
export function PriceCell({ dish, currency }: { dish: Dish; currency: string | null }) {
  if (dish.price_status === "market_price")
    return (
      <span className="tag-mp" title="Market price">
        MP
      </span>
    );
  if (dish.price_status === "not_listed" || dish.price === null)
    return (
      <span className="no-price">
        No price
        <br />
        listed
      </span>
    );
  return <span className="price">{formatPrice(dish.price, currency)}</span>;
}

/** Sends the person somewhere else after render, for screens opened without what they need. */
export function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}
