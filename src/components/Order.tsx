import { estimate } from "../../shared/order";
import { formatPrice } from "../lib/format";
import { useMenuStore } from "../lib/menuStore";
import { addToOrder, orderCount, useOrder } from "../lib/orderStore";
import { navigate } from "../lib/router";

/** "Add to my order", or a count and "add one more" once it's in. Adds with the size and add-ons picked. */
export function AddButton({
  dish,
  big = false,
  size,
  addOns,
  price,
}: {
  dish: number;
  big?: boolean;
  size?: string;
  addOns?: string[];
  /** The price with the picked choices, shown on the button. */
  price?: string | null;
}) {
  const { items } = useOrder();
  const count = items.filter((i) => i.dish === dish).reduce((n, i) => n + i.quantity, 0);
  return (
    <button
      type="button"
      className={big ? "btn btn-primary" : "btn btn-outline"}
      style={{ width: "100%" }}
      onClick={() => addToOrder(dish, { size, addOns })}
    >
      {count ? `${count} in your order, add one more` : "Add to my order"}
      {price ? `, ${price}` : ""}
    </button>
  );
}

/** The oxblood bar at the bottom of For you and Full menu once the order has something in it. */
export function OrderBar() {
  const { menu } = useMenuStore();
  const { items, taxPercent, tipPercent } = useOrder();
  const count = orderCount(items);
  if (!menu || count === 0) return null;
  const e = estimate(items, menu.menu.dishes, parseFloat(taxPercent), tipPercent);
  return (
    <div className="order-bar">
      <a
        href="/order"
        onClick={(ev) => {
          ev.preventDefault();
          navigate("/order", { replace: true });
        }}
      >
        {count} {count === 1 ? "dish" : "dishes"}
        {e.subtotal > 0 ? `, about ${formatPrice(Math.round(e.total), menu.menu.currency)}` : ""}
      </a>
      <SplitButton />
    </div>
  );
}

export function SplitButton() {
  return (
    <button type="button" className="bar-btn" onClick={() => navigate("/split")}>
      Split it with someone
    </button>
  );
}

/** The bar at the bottom of the Order tab. */
export function ShareMoreBar() {
  return (
    <div className="order-bar">
      <span>Want to share more?</span>
      <SplitButton />
    </div>
  );
}
