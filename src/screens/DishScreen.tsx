import { CATEGORY_LABEL } from "../../shared/categories";
import { AddButton } from "../components/Order";
import { Plate } from "../components/Plate";
import { BackButton, PriceCell, Redirect, WarnIcon } from "../components/ui";
import { ALLERGEN_LABEL, capitalize, formatPrice } from "../lib/format";
import { useMenuStore } from "../lib/menuStore";
import { EMPTY_PROFILE } from "../../shared/profile";
import { scoreDish } from "../../shared/rank";
import { useProfile } from "../lib/profileStore";
import { reasons } from "../lib/reasons";
import { useReread } from "./MenuScreen";

export function DishScreen({ index }: { index: number }) {
  const { menu } = useMenuStore();
  const profile = useProfile();
  const reread = useReread();
  const dish = menu?.menu.dishes[index];
  if (!menu || !dish) return <Redirect to={menu ? "/menu" : "/"} />;

  const stated = dish.ingredients.filter((i) => i.source === "stated");
  const guessed = dish.ingredients.filter((i) => i.source === "likely");
  const statedAllergens = dish.allergens.filter((a) => a.source === "stated");
  const likelyAllergens = dish.allergens.filter((a) => a.source === "likely");
  const list = (items: typeof dish.allergens) => items.map((a) => ALLERGEN_LABEL[a.allergen]).join(", ");

  return (
    <main className="screen" style={{ gap: 14 }}>
      <div className="dish-hero">
        <BackButton fallback="/picks" label="Back to the menu" />
        <Plate
          category={dish.category}
          size={150}
          label={`Drawing of ${CATEGORY_LABEL[dish.category].toLowerCase()}`}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
        <div className="dish-head">
          <h1>{dish.name}</h1>
          <div style={{ fontSize: 20 }}>
            <PriceCell dish={dish} currency={menu.menu.currency} />
          </div>
        </div>
        {dish.description && (
          <div style={{ fontSize: 15, color: "var(--muted-strong)" }}>The menu says: "{dish.description}"</div>
        )}
      </div>

      {statedAllergens.length > 0 && (
        <div className="warn-box">
          <WarnIcon size={20} />
          <span>
            <b>Has {list(statedAllergens)}.</b> The menu says so.
          </span>
        </div>
      )}
      {likelyAllergens.length > 0 && (
        <div className="warn-box">
          <WarnIcon size={20} />
          <span>
            <b>Might have {list(likelyAllergens)}.</b> That's our guess, and the menu doesn't say, so ask your server.
          </span>
        </div>
      )}

      {(stated.length > 0 || guessed.length > 0) && (
        <div className="panel panel-pad" style={{ borderRadius: 20 }}>
          <h2>What's in it</h2>
          {stated.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="chip-label">On the menu</div>
              <div className="chips">
                {stated.map((i) => (
                  <span key={i.name} className="chip">
                    {capitalize(i.name)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {guessed.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="chip-label">Our guess, not on the menu</div>
              <div className="chips">
                {guessed.map((i) => (
                  <span key={i.name} className="chip chip-guess">
                    {capitalize(i.name)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {profile && <ForYou {...forYou(scoreDish(dish, index, profile))} />}

      {dish.options.length > 0 && (
        <div className="panel panel-pad" style={{ borderRadius: 20, gap: 8 }}>
          <h2>Choices and add-ons</h2>
          {dish.options.map((o) => (
            <div key={o.name} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 15 }}>
              <span>{capitalize(o.name)}</span>
              {o.price_delta !== null && (
                <span className="price">+{formatPrice(o.price_delta, menu.menu.currency)}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {dish.diet_tags.length > 0 && (
        <div className="chips">
          {dish.diet_tags.map((t) => (
            <span key={t} className="chip" style={{ background: "var(--surface)" }}>
              {capitalize(t)}
            </span>
          ))}
        </div>
      )}

      <button type="button" className="link-btn" style={{ alignSelf: "center" }} onClick={reread}>
        This looks wrong
      </button>
      <div className="grow" />
      <AddButton dish={index} big />
    </main>
  );
}

function forYou(r: ReturnType<typeof scoreDish>) {
  const { good, bad } = reasons(r);
  if (r.allergens.length) {
    const sunk = "We moved this down your list because it might have something you can't eat.";
    return { verdict: "For you: be careful", text: [...good, sunk].join(" ") };
  }
  if (bad.length && good.length) return { verdict: "For you: maybe", text: [...good, ...bad].join(" ") };
  if (bad.length) return { verdict: "For you: probably not", text: bad.join(" ") };
  if (good.length) return { verdict: "For you: yes", text: good.join(" ") };
  return { verdict: "For you: fine", text: "Nothing here clashes with your tastes." };
}

function ForYou({ verdict, text }: { verdict: string; text: string }) {
  return (
    <div className="panel panel-pad" style={{ borderRadius: 20, gap: 4 }}>
      <h2>{verdict}</h2>
      <div style={{ fontSize: 15, color: "var(--muted-strong)", lineHeight: 1.4 }}>{text}</div>
    </div>
  );
}
