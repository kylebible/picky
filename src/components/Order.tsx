import { estimate } from "../../shared/order";
import { formatPrice } from "../lib/format";
import { useMenuStore } from "../lib/menuStore";
import { addToOrder, orderCount, useOrder } from "../lib/orderStore";
import { navigate } from "../lib/router";

/** "Add to my order", or a count and "add one more" once it's in. */
export function AddButton({ dish, big = false }: { dish: number; big?: boolean }) {
  const { items } = useOrder();
  const inOrder = items.find((i) => i.dish === dish);
  return (
    <button
      type="button"
      className={big ? "btn btn-primary" : "btn btn-outline"}
      style={{ width: "100%" }}
      onClick={() => addToOrder(dish)}
    >
      {inOrder ? `${inOrder.quantity} in your order, add one more` : "Add to my order"}
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
