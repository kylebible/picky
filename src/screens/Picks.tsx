import { rankMenu } from "../../shared/rank";
import { EMPTY_PROFILE } from "../../shared/profile";
import { MenuHeader } from "../components/MenuHeader";
import { Plate } from "../components/Plate";
import { PriceCell, Redirect, WarnIcon } from "../components/ui";
import { useMenuStore } from "../lib/menuStore";
import { useProfile } from "../lib/profileStore";
import { allergenWarning, reasons, rowReason } from "../lib/reasons";
import { navigate } from "../lib/router";
import { CATEGORY_LABEL } from "../../shared/categories";

export function Picks() {
  const { menu } = useMenuStore();
  const profile = useProfile();
  if (!menu) return <Redirect to="/" />;
  const { restaurant_name, currency, dishes } = menu.menu;
  const ranked = rankMenu(dishes, profile ?? EMPTY_PROFILE);
  const [top, ...rest] = ranked;
  const open = (i: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(`/dish/${i}`);
  };
  const topSafe = top && top.allergens.length === 0;

  return (
    <main className="screen" style={{ gap: 14 }}>
      <MenuHeader title={restaurant_name ?? "Your menu"} tab="picks" />

      {!profile && (
        <div className="note" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>Tell us what you can't eat and what you're into, and we'll sort this list for you.</span>
          <button type="button" className="btn-outline btn" onClick={() => navigate("/setup/allergies?then=/picks")}>
            Set up your tastes
          </button>
        </div>
      )}

      {ranked.length === 0 && (
        <div className="note">No food on this menu yet. The full menu has everything we read.</div>
      )}

      {top && topSafe && (
        <a
          className="hero-card"
          href={`/dish/${top.index}`}
          onClick={open(top.index)}
          style={{ textDecoration: "none" }}
        >
          <div className="art">
            <Plate
              category={top.dish.category}
              size={104}
              label={`Drawing of ${CATEGORY_LABEL[top.dish.category].toLowerCase()}`}
            />
            <span className="badge">Start here</span>
          </div>
          <div className="body">
            <div className="dish-head">
              <div className="display" style={{ fontSize: 22 }}>
                {top.dish.name}
              </div>
              <div style={{ fontSize: 18 }}>
                <PriceCell dish={top.dish} currency={currency} />
              </div>
            </div>
            <div style={{ fontSize: 15, color: "var(--muted)" }}>
              {reasons(top).good.join(" ") || top.dish.description || "Our best guess for you on this menu."}
            </div>
          </div>
        </a>
      )}

      {(topSafe ? rest : ranked).length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {topSafe && <h2>Also good for you</h2>}
          <div className="panel" style={{ borderRadius: 18 }}>
            {(topSafe ? rest : ranked).map((r) => {
              const warning = allergenWarning(r);
              const why = rowReason(r);
              return (
                <a key={r.index} className="row" href={`/dish/${r.index}`} onClick={open(r.index)}>
                  <Plate category={r.dish.category} />
                  <div className="row-main">
                    <div className="row-name">{r.dish.name}</div>
                    {warning ? (
                      <div className="warn-tag">
                        <WarnIcon />
                        {warning}
                      </div>
                    ) : (
                      (why ?? r.dish.description) && <div className="row-sub">{why ?? r.dish.description}</div>
                    )}
                  </div>
                  <PriceCell dish={r.dish} currency={currency} />
                </a>
              );
            })}
          </div>
        </section>
      )}

      <p className="small center" style={{ margin: 0 }}>
        Allergy info is a warning, never a guarantee. Always check with your server.
      </p>
    </main>
  );
}
