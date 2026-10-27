import { useState } from "react";
import type { Dish } from "../../shared/menu";
import { estimate, itemPrice, lineTotal, type OrderItem } from "../../shared/order";
import { MenuHeader } from "../components/MenuHeader";
import { Plate } from "../components/Plate";
import { Redirect } from "../components/ui";
import { formatPrice } from "../lib/format";
import { useMenuStore } from "../lib/menuStore";
import { setTax, setTip, updateItem, useOrder } from "../lib/orderStore";
import { navigate } from "../lib/router";

const TIPS = [15, 18, 20];
const money = (n: number, currency: string | null) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: currency ?? "USD" }).format(n);

export function OrderScreen() {
  const { menu } = useMenuStore();
  const { items, taxPercent, tipPercent } = useOrder();
  const [otherTip, setOtherTip] = useState(!TIPS.includes(tipPercent));
  if (!menu) return <Redirect to="/" />;
  const { restaurant_name, currency, dishes } = menu.menu;
  const fmt = (n: number) => {
    try {
      return money(n, currency);
    } catch {
      return n.toFixed(2);
    }
  };
  const e = estimate(items, dishes, parseFloat(taxPercent), tipPercent);
  const unpricedNames = e.unpriced.map((i) => dishes[i]?.name).filter(Boolean);

  return (
    <main className="screen" style={{ gap: 14 }}>
      <MenuHeader title={restaurant_name ?? "Your menu"} tab="order" />

      {items.length === 0 ? (
        <div className="note" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span>Nothing in your order yet. Add dishes from For you or the full menu to see about what you'll pay.</span>
          <button type="button" className="btn btn-outline" onClick={() => navigate("/picks", { replace: true })}>
            See what's good for you
          </button>
        </div>
      ) : (
        <>
          <div className="panel" style={{ borderRadius: 20 }}>
            {items.map((item) => {
              const dish = dishes[item.dish];
              return dish ? <OrderRow key={item.dish} item={item} dish={dish} fmt={fmt} currency={currency} /> : null;
            })}
          </div>

          <div className="panel panel-pad" style={{ borderRadius: 20 }}>
            <div className="sum-row">
              <span>Subtotal</span>
              <b>{fmt(e.subtotal)}</b>
            </div>
            <div className="sum-row">
              <label htmlFor="tax" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                Tax
                <span className="pct-input">
                  <input
                    id="tax"
                    inputMode="decimal"
                    value={taxPercent}
                    placeholder="0"
                    onChange={(ev) => setTax(ev.target.value.replace(/[^0-9.]/g, ""))}
                  />
                  %
                </span>
              </label>
              <b>{fmt(e.tax)}</b>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="sum-row">
                <span id="tip-label">Tip</span>
                <b>{fmt(e.tip)}</b>
              </div>
              <div
                className="toggles"
                role="group"
                aria-labelledby="tip-label"
                style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}
              >
                {TIPS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="toggle"
                    aria-pressed={!otherTip && tipPercent === t}
                    onClick={() => {
                      setOtherTip(false);
                      setTip(t);
                    }}
                  >
                    {t}%
                  </button>
                ))}
                <button type="button" className="toggle" aria-pressed={otherTip} onClick={() => setOtherTip(true)}>
                  Other
                </button>
              </div>
              {otherTip && (
                <label htmlFor="tip" className="sum-row" style={{ justifyContent: "flex-start", gap: 8 }}>
                  Tip percent
                  <span className="pct-input">
                    <input
                      id="tip"
                      inputMode="decimal"
                      value={Number.isFinite(tipPercent) ? String(tipPercent) : ""}
                      onChange={(ev) => setTip(parseFloat(ev.target.value.replace(/[^0-9.]/g, "")) || 0)}
                    />
                    %
                  </span>
                </label>
              )}
            </div>
            <div className="total-row">
              <span className="display" style={{ fontSize: 18 }}>
                You'll pay about
              </span>
              <span className="display" style={{ fontSize: 26 }}>
                {fmt(e.total)}
              </span>
            </div>
            <div className="small" style={{ color: "var(--muted)" }}>
              An estimate, not the bill.
              {unpricedNames.length > 0 &&
                ` ${listNames(unpricedNames)} ${unpricedNames.length === 1 ? "isn't" : "aren't"} counted until you add a price.`}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function listNames(names: string[]) {
  if (names.length === 1) return `The ${names[0].toLowerCase()}`;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function OrderRow({
  item,
  dish,
  fmt,
  currency,
}: {
  item: OrderItem;
  dish: Dish;
  fmt: (n: number) => string;
  currency: string | null;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const line = lineTotal(item, dish);
  const price = itemPrice(item, dish);
  const needsPrice = dish.price_status !== "listed" || dish.price === null;

  return (
    <div className="row" style={{ cursor: "default", alignItems: "flex-start" }}>
      <Plate category={dish.category} />
      <div className="row-main">
        <div className="row-name">{dish.name}</div>
        <button
          type="button"
          className="share-toggle"
          aria-pressed={item.shared}
          onClick={() => updateItem(item.dish, { shared: !item.shared })}
        >
          {item.shared
            ? `Shared, half of ${price === null ? "the price" : formatPrice(price * item.quantity, currency)}. Undo`
            : "Just for you. Sharing it?"}
        </button>
        <div className="order-line">
          <div className="stepper">
            <button
              type="button"
              aria-label={`One fewer ${dish.name}`}
              onClick={() => updateItem(item.dish, { quantity: item.quantity - 1 })}
            >
              −
            </button>
            <span aria-live="polite">{item.quantity}</span>
            <button
              type="button"
              aria-label={`One more ${dish.name}`}
              onClick={() => updateItem(item.dish, { quantity: item.quantity + 1 })}
            >
              +
            </button>
          </div>
          {line !== null && !editingPrice ? (
            <button
              type="button"
              className="line-total"
              disabled={!needsPrice}
              aria-label={needsPrice ? `Change the price of ${dish.name}` : undefined}
              onClick={() => setEditingPrice(true)}
            >
              {fmt(line)}
            </button>
          ) : editingPrice ? (
            <form
              className="price-form"
              onSubmit={(ev) => {
                ev.preventDefault();
                const value = parseFloat(new FormData(ev.currentTarget).get("price") as string);
                updateItem(item.dish, { price: Number.isFinite(value) && value > 0 ? value : undefined });
                setEditingPrice(false);
              }}
            >
              <label className="visually-hidden" htmlFor={`price-${item.dish}`}>
                Price of {dish.name}
              </label>
              <input
                id={`price-${item.dish}`}
                name="price"
                inputMode="decimal"
                autoFocus
                defaultValue={item.price ?? ""}
              />
              <button type="submit" className="btn btn-outline" style={{ height: 36 }}>
                Save
              </button>
            </form>
          ) : (
            <button type="button" className="btn btn-outline add-price" onClick={() => setEditingPrice(true)}>
              Add price
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
