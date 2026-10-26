import type { Dish } from "../../shared/menu";
import { Plate } from "../components/Plate";
import { PriceCell, Redirect, Wordmark } from "../components/ui";
import { readMenu, useMenuStore } from "../lib/menuStore";
import { navigate } from "../lib/router";

type Section = { title: string; dishes: { dish: Dish; index: number }[] };

/** Groups dishes under their menu headings, keeping the menu's order. */
export function groupBySection(dishes: Dish[]): Section[] {
  const sections: Section[] = [];
  dishes.forEach((dish, index) => {
    const title = dish.section?.trim() || "On the menu";
    let section = sections.find((s) => s.title === title);
    if (!section) sections.push((section = { title, dishes: [] }));
    section.dishes.push({ dish, index });
  });
  return sections;
}

/** Re-reads with the stronger model while the photos are still in memory, else asks for new photos. */
export function useReread() {
  const { photos } = useMenuStore();
  return () => {
    if (photos.length) {
      readMenu(photos, { strong: true });
      navigate("/reading");
    } else {
      navigate("/snap");
    }
  };
}

export function MenuScreen() {
  const { menu } = useMenuStore();
  const reread = useReread();
  if (!menu) return <Redirect to="/" />;
  const { restaurant_name, currency, dishes } = menu.menu;
  const sections = groupBySection(dishes);

  return (
    <main className="screen" style={{ gap: 14 }}>
      <div className="topbar">
        <Wordmark />
        <button type="button" className="link-btn" onClick={() => navigate("/snap")}>
          New menu
        </button>
      </div>
      <h1 style={{ fontSize: 28, letterSpacing: -0.6 }}>{restaurant_name ?? "Your menu"}</h1>

      {sections.length > 1 && (
        <nav className="jump" aria-label="Menu sections">
          {sections.map((s, i) => (
            <a
              key={s.title}
              href={`#section-${i}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(`section-${i}`)?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {s.title}
            </a>
          ))}
        </nav>
      )}

      {dishes.length === 0 && (
        <div className="note">We didn't find any dishes in those photos. Try a closer, sharper photo of the menu.</div>
      )}

      {sections.map((s, i) => (
        <section key={s.title} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 id={`section-${i}`} className="section-title">
            {s.title}
          </h2>
          <div className="panel" style={{ borderRadius: 20 }}>
            {s.dishes.map(({ dish, index }) => (
              <a
                key={index}
                className="row"
                href={`/dish/${index}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/dish/${index}`);
                }}
              >
                <Plate category={dish.category} />
                <div className="row-main">
                  <div className="row-name">{dish.name}</div>
                  {dish.description && <div className="row-sub">{dish.description}</div>}
                </div>
                <PriceCell dish={dish} currency={currency} />
              </a>
            ))}
          </div>
        </section>
      ))}

      <button type="button" className="link-btn" style={{ alignSelf: "center" }} onClick={reread}>
        Something look wrong? Read it again
      </button>
      <p className="small center" style={{ margin: 0 }}>
        Allergens and ingredients marked as our guess aren't on the menu. Always check with your server.
      </p>
    </main>
  );
}
