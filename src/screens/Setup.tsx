import { useState } from "react";
import { EMPTY_PROFILE, type Allergen, type Diet, type Feeling, type Profile, TASTES } from "../../shared/profile";
import { TASTE_LABEL } from "../../shared/rank";
import { BackButton } from "../components/ui";
import { saveProfile, useProfile } from "../lib/profileStore";
import { navigate } from "../lib/router";

// Two setup steps: what you can't eat, then what you're into. Each step saves
// on its way out, so skipping still marks setup as done.

const COMMON: { label: string; allergens: Allergen[] }[] = [
  { label: "Peanuts", allergens: ["peanuts"] },
  { label: "Tree nuts", allergens: ["tree_nuts"] },
  { label: "Milk", allergens: ["milk"] },
  { label: "Eggs", allergens: ["egg"] },
  { label: "Wheat or gluten", allergens: ["gluten"] },
  { label: "Soy", allergens: ["soy"] },
  { label: "Fish", allergens: ["fish"] },
  { label: "Shellfish", allergens: ["crustaceans", "molluscs"] },
  { label: "Sesame", allergens: ["sesame"] },
];
const MORE: { label: string; allergens: Allergen[] }[] = [
  { label: "Celery", allergens: ["celery"] },
  { label: "Mustard", allergens: ["mustard"] },
  { label: "Sulphites", allergens: ["sulphites"] },
  { label: "Lupin", allergens: ["lupin"] },
];
const DIET_LABEL: Record<Diet, string> = {
  anything: "Anything",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  halal: "Halal",
  kosher: "Kosher",
};

/** Where to go when setup finishes: `?then=` when editing from the menu, else the camera. */
function thenPath() {
  const then = new URLSearchParams(location.search).get("then");
  return then?.startsWith("/") ? then : "/snap";
}

const Check = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12l5 5 9-10" />
  </svg>
);

function Steps({ step }: { step: 1 | 2 }) {
  return (
    <div className="steps" role="img" aria-label={`Step ${step} of 2`}>
      <span className="on" />
      <span className={step === 2 ? "on" : ""} />
    </div>
  );
}

export function SetupAllergies() {
  const saved = useProfile() ?? EMPTY_PROFILE;
  const [allergies, setAllergies] = useState<Allergen[]>(saved.allergies);
  const [diet, setDiet] = useState<Diet>(saved.diet);
  const [showMore, setShowMore] = useState(MORE.some((m) => m.allergens.some((a) => saved.allergies.includes(a))));
  const then = thenPath();
  const next = `/setup/tastes${then === "/snap" ? "" : `?then=${encodeURIComponent(then)}`}`;

  const toggle = (group: Allergen[]) =>
    setAllergies((cur) =>
      group.every((a) => cur.includes(a))
        ? cur.filter((a) => !group.includes(a))
        : [...cur, ...group.filter((a) => !cur.includes(a))],
    );

  const chip = ({ label, allergens: group }: (typeof COMMON)[number]) => {
    const on = group.every((a) => allergies.includes(a));
    return (
      <button key={label} type="button" className="toggle" aria-pressed={on} onClick={() => toggle(group)}>
        {on && <Check />}
        {label}
      </button>
    );
  };

  function go(path: string, save: boolean) {
    saveProfile(save ? { ...saved, allergies, diet } : saved);
    navigate(path, { replace: true });
  }

  return (
    <main className="screen">
      <div className="topbar">
        <BackButton fallback="/" />
        <Steps step={1} />
        <button type="button" className="link-btn" onClick={() => go(next, false)}>
          Skip
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1>Anything you can't eat?</h1>
        <p className="lede">We'll warn you about dishes that might have these, and move them down your list.</p>
      </div>
      <section className="panel panel-pad" style={{ padding: 16 }}>
        <h2>Allergies</h2>
        <div className="toggles">
          {COMMON.map(chip)}
          {showMore ? (
            MORE.map(chip)
          ) : (
            <button type="button" className="toggle more" onClick={() => setShowMore(true)}>
              + Something else
            </button>
          )}
        </div>
      </section>
      <section className="panel panel-pad" style={{ padding: 16 }}>
        <h2>How do you eat?</h2>
        <div className="toggles grid3">
          {(Object.keys(DIET_LABEL) as Diet[]).map((d) => (
            <button key={d} type="button" className="toggle" aria-pressed={diet === d} onClick={() => setDiet(d)}>
              {DIET_LABEL[d]}
            </button>
          ))}
        </div>
      </section>
      <div className="grow" />
      <p className="small center" style={{ margin: 0 }}>
        Picky can't promise a dish is safe. Always tell your server about allergies.
      </p>
      <button type="button" className="btn btn-primary" onClick={() => go(next, true)}>
        Next: what you like
      </button>
    </main>
  );
}

export function SetupTastes() {
  const saved = useProfile() ?? EMPTY_PROFILE;
  const [tastes, setTastes] = useState<Profile["tastes"]>(saved.tastes);
  const [notes, setNotes] = useState(saved.notes);
  const then = thenPath();

  function go(save: boolean) {
    saveProfile(save ? { ...saved, tastes, notes: notes.trim() } : saved);
    navigate(then, { replace: true });
  }

  return (
    <main className="screen" style={{ gap: 16 }}>
      <div className="topbar">
        <BackButton fallback="/setup/allergies" />
        <Steps step={2} />
        <button type="button" className="link-btn" onClick={() => go(false)}>
          Skip
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1>What are you into?</h1>
        <p className="lede">Quick gut reactions are fine. You can change these any time.</p>
      </div>
      <section className="panel" style={{ padding: "4px 14px" }}>
        {TASTES.map((t) => {
          const feeling = tastes[t] ?? "fine";
          return (
            <div className="taste-row" key={t} role="group" aria-label={TASTE_LABEL[t]}>
              <span>{TASTE_LABEL[t]}</span>
              <span className="seg">
                {(["love", "fine", "nope"] as Feeling[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={f}
                    aria-pressed={feeling === f}
                    onClick={() => setTastes((cur) => ({ ...cur, [t]: f }))}
                  >
                    {f === "love" ? "Love" : f === "fine" ? "Fine" : "Nope"}
                  </button>
                ))}
              </span>
            </div>
          );
        })}
      </section>
      <div className="field">
        <label htmlFor="other-tastes">Anything else?</label>
        <input
          id="other-tastes"
          className="input"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="I can't stand raisins, love anything with lemon..."
        />
      </div>
      <div className="grow" />
      <button type="button" className="btn btn-primary" onClick={() => go(true)}>
        {then === "/snap" ? "Done, let's eat" : "Save"}
      </button>
    </main>
  );
}
