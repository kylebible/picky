import { useEffect, useState } from "react";
import { CATEGORY_LABEL } from "../../shared/categories";
import type { Dish } from "../../shared/menu";
import { EMPTY_PROFILE, TASTES, type Allergen, type Diet, type Profile, type Taste } from "../../shared/profile";
import { TASTE_LABEL } from "../../shared/rank";
import {
  almost,
  deckFor,
  eaterFrom,
  eatersOf,
  MAX_PEOPLE,
  QUICK_ALLERGIES,
  TABLE_CODE,
  type Member,
} from "../../shared/split";
import { Plate } from "../components/Plate";
import { Qr } from "../components/Qr";
import { SwipeCard } from "../components/SwipeCard";
import { BackButton, PriceCell, Redirect, Wordmark } from "../components/ui";
import { formatPrice } from "../lib/format";
import { adoptMenu, useMenuStore } from "../lib/menuStore";
import { addToOrder, useOrder } from "../lib/orderStore";
import { saveProfile, useProfile } from "../lib/profileStore";
import { navigate } from "../lib/router";
import { createTable, dismissMatch, joinTable, loadTable, swipe, useTable } from "../lib/tableStore";

// Split it: the host shows a QR code, tablemates join in their browser,
// everyone swipes on the same menu, and dishes everyone who can have them
// likes become matches.

const initial = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

/** "Sam", "Sam and Alex", "Sam, Alex and Jo". */
export function listNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** "You and Sam", "You, Sam and Alex", or "You and 4 others" for a big table. */
function youAnd(others: Member[]) {
  if (others.length === 0) return "Just you";
  if (others.length > 3) return `You and ${others.length} others`;
  return `You${others.length > 1 ? ", " : " and "}${listNames(others.map((m) => m.name || "someone"))}`;
}

function Avatars({ members, size = 32 }: { members: Member[]; size?: number }) {
  return (
    <span style={{ display: "flex" }} aria-hidden="true">
      {members.map((m, i) => (
        <span
          key={m.id}
          className="avatar"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.42,
            background: m.host ? "var(--plate-mains)" : "var(--tablemate)",
            marginLeft: i ? -size * 0.28 : 0,
          }}
        >
          {initial(m.name)}
        </span>
      ))}
    </span>
  );
}

/** The price split between the people sharing, as "about $8 each", or null when there's no price. */
function each(dish: Dish, currency: string | null, people: number) {
  if (dish.price_status !== "listed" || dish.price === null) return null;
  return `about ${formatPrice(Math.round((dish.price * 100) / Math.max(2, people)) / 100, currency)} each`;
}

/** Host: asks for a first name once, then makes a table and shows its code. */
export function SplitStart() {
  const { menu } = useMenuStore();
  const profile = useProfile() ?? EMPTY_PROFILE;
  const table = useTable();
  const [name, setName] = useState(profile.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start(firstName: string) {
    if (!menu) return;
    setBusy(true);
    setError(null);
    try {
      const code = await createTable({
        menu: menu.menu,
        name: firstName,
        ...eaterFrom(profile),
      });
      navigate(`/split/${code}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  useEffect(() => {
    // Already at a table for this menu: go back to it. Else start one if we know your name.
    if (table.code) navigate(`/split/${table.code}`, { replace: true });
    else if (profile.name && menu) start(profile.name);
  }, []);

  if (!menu) return <Redirect to="/" />;
  if (table.code || (profile.name && !error)) {
    return (
      <main className="screen">
        <div className="topbar" />
        <h1>Setting up your table</h1>
      </main>
    );
  }

  return (
    <main className="screen">
      <div className="topbar">
        <BackButton fallback="/picks" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1>Split some dishes</h1>
        <p className="lede">Your tablemates will see your first name when they join.</p>
      </div>
      <form
        style={{ display: "flex", flexDirection: "column", gap: 18 }}
        onSubmit={(e) => {
          e.preventDefault();
          const firstName = name.trim();
          if (!firstName) return;
          saveProfile({ ...profile, name: firstName });
          start(firstName);
        }}
      >
        <div className="field">
          <label htmlFor="host-name">Your first name</label>
          <input
            id="host-name"
            className="input"
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />
        </div>
        {error && <div className="error-box">{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
          Get a table code
        </button>
      </form>
    </main>
  );
}

/** The QR code and table code, waiting for a tablemate, or for someone else to join. */
export function Share({ code }: { code: string }) {
  const table = useTable();
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/t/${code}`;
  const joined = table.members.filter((m) => m.name).length;
  // Opened to add someone else: stay here until they arrive, then go back to swiping.
  const [joinedAtOpen, setJoinedAtOpen] = useState<number | null>(null);

  useEffect(() => joinTable(code), [code]);
  useEffect(() => {
    if (table.you && joinedAtOpen === null) setJoinedAtOpen(Math.max(1, joined));
    else if (joinedAtOpen !== null && joined > joinedAtOpen) navigate(`/split/${code}/swipe`, { replace: true });
  }, [table.you, joined, joinedAtOpen, code]);
  const adding = joinedAtOpen !== null && joinedAtOpen > 1;

  async function sendLink() {
    const text = "Swipe on the menu with me on Picky";
    if (navigator.share) {
      await navigator.share({ title: "Picky", text, url: link }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
  }

  if (table.connection === "gone") return <TableGone />;

  return (
    <main className="screen">
      <div className="topbar">
        <BackButton fallback="/picks" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1>{adding ? "Have the next person scan this" : "Have your tablemate scan this"}</h1>
        <p className="lede">It opens in their phone's browser. Nothing to download, no account needed.</p>
      </div>
      <div className="panel qr-card">
        <Qr text={link} label="QR code to join your table" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>Or they can type the table code</div>
          <div className="display table-code">{code}</div>
        </div>
      </div>
      <button type="button" className="btn btn-secondary" onClick={sendLink}>
        {copied ? "Link copied. Paste it in a message" : "Send a link instead"}
      </button>
      <div className="grow" />
      <div className="waiting" role="status">
        <span className="pulse" aria-hidden="true" />
        <div style={{ fontSize: 15, lineHeight: 1.35 }}>
          {table.connection === "closed"
            ? "Reconnecting to your table..."
            : adding
              ? "Anyone who joins gets their own cards. Up to " + MAX_PEOPLE + " people can sit at a table."
              : "Waiting for them to join. You'll both start swiping as soon as they do."}
        </div>
      </div>
      {adding && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate(`/split/${code}/swipe`, { replace: true })}
        >
          Back to swiping
        </button>
      )}
    </main>
  );
}

function TableGone() {
  return (
    <main className="screen">
      <div className="topbar">
        <Wordmark />
      </div>
      <h1>This table has closed</h1>
      <p className="lede">Tables last 12 hours, or the code may be wrong. Ask for a new code.</p>
      <div className="grow" />
      <button type="button" className="btn btn-primary" onClick={() => navigate("/", { replace: true })}>
        Go to Picky
      </button>
    </main>
  );
}

/** Tablemate: type a 4-digit code, for when scanning didn't work. */
export function JoinCode() {
  const [code, setCode] = useState("");
  return (
    <main className="screen">
      <div className="topbar">
        <BackButton fallback="/" />
      </div>
      <h1>Join a table</h1>
      <p className="lede">Ask whoever you're eating with for the 4-digit code under their QR code.</p>
      <form
        style={{ display: "flex", flexDirection: "column", gap: 18 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (TABLE_CODE.test(code)) navigate(`/t/${code}`, { replace: true });
        }}
      >
        <div className="field">
          <label htmlFor="table-code">Table code</label>
          <input
            id="table-code"
            className="input display table-code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={!TABLE_CODE.test(code)}>
          Join
        </button>
      </form>
    </main>
  );
}

/** Their tastes with exactly these marked "nope". */
function nopedTastes(tastes: Profile["tastes"], nopes: Taste[]): Profile["tastes"] {
  const next = { ...tastes };
  for (const t of TASTES) {
    if (nopes.includes(t)) next[t] = "nope";
    else if (next[t] === "nope") delete next[t];
  }
  return next;
}

/** Tablemate: first name, a quick allergy list and dislikes, no account. */
export function Join({ code }: { code: string }) {
  const profile = useProfile();
  const table = useTable();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(profile?.name ?? "");
  const [picked, setPicked] = useState<string[]>(() =>
    QUICK_ALLERGIES.filter(
      (q) =>
        (q.allergens.length && q.allergens.every((a) => profile?.allergies.includes(a))) ||
        (q.diet && q.diet === profile?.diet),
    ).map((q) => q.label),
  );
  const [showMore, setShowMore] = useState(false);
  const [nopes, setNopes] = useState<Taste[]>(() => TASTES.filter((t) => profile?.tastes[t] === "nope"));

  useEffect(() => {
    loadTable(code)
      .then((info) => adoptMenu(info.menu))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [code]);

  // Back on the same phone after joining before: carry on swiping.
  const alreadyIn = table.code === code && table.you && table.members.some((m) => m.id === table.you && m.name);
  if (alreadyIn) return <Redirect to={`/split/${code}/swipe`} />;

  if (error) {
    return (
      <main className="screen">
        <div className="topbar">
          <Wordmark />
        </div>
        <h1>We couldn't find that table</h1>
        <div className="error-box">{error}</div>
        <div className="grow" />
        <button type="button" className="btn btn-primary" onClick={() => navigate("/join", { replace: true })}>
          Type the code again
        </button>
      </main>
    );
  }

  const info = table.code === code ? table.info : null;
  const choices = showMore ? QUICK_ALLERGIES : QUICK_ALLERGIES.slice(0, 5);

  function start() {
    const firstName = name.trim();
    if (!firstName) return;
    const chosen = QUICK_ALLERGIES.filter((q) => picked.includes(q.label));
    const allergies = [...new Set(chosen.flatMap((q) => q.allergens))] as Allergen[];
    const diet: Diet = chosen.find((q) => q.diet)?.diet ?? profile?.diet ?? "anything";
    const saved = {
      ...(profile ?? EMPTY_PROFILE),
      name: firstName,
      allergies: [...new Set([...(profile?.allergies ?? []), ...allergies])],
      diet,
      tastes: nopedTastes(profile?.tastes ?? {}, nopes),
    };
    saveProfile(saved);
    joinTable(code, { type: "hello", name: firstName, ...eaterFrom(saved), allergies });
    navigate(`/split/${code}/swipe`, { replace: true });
  }

  return (
    <main className="screen">
      <Wordmark />
      {info ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="avatar" style={{ width: 48, height: 48, fontSize: 18, background: "var(--plate-mains)" }}>
              {initial(info.hostName)}
            </span>
            <h1 style={{ fontSize: 26, letterSpacing: -0.6, lineHeight: 1.1 }}>
              {info.hostName} wants to split some dishes{info.restaurant ? ` at ${info.restaurant}` : ""}
            </h1>
          </div>
          {info.full && (
            <div className="error-box">{MAX_PEOPLE} people are already at this table, so you can't join it.</div>
          )}
        </>
      ) : (
        <h1>Finding the table...</h1>
      )}
      <p className="lede">
        You'll swipe through the menu together. When everyone who can eat a dish likes it, it's a match.
      </p>
      <div className="field">
        <label htmlFor="tm-name">Your first name</label>
        <input
          id="tm-name"
          className="input"
          autoComplete="given-name"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ height: 52, fontSize: 17 }}
        />
      </div>
      <section className="panel panel-pad" style={{ padding: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2>Anything you can't eat?</h2>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>Tap any that apply, so nobody sees those dishes.</div>
        </div>
        <div className="toggles grid3">
          {choices.map((q) => (
            <button
              key={q.label}
              type="button"
              className="toggle"
              style={{ minHeight: 48 }}
              aria-pressed={picked.includes(q.label)}
              onClick={() =>
                setPicked((cur) => (cur.includes(q.label) ? cur.filter((l) => l !== q.label) : [...cur, q.label]))
              }
            >
              {q.label}
            </button>
          ))}
          {!showMore && (
            <button type="button" className="toggle more" style={{ minHeight: 48 }} onClick={() => setShowMore(true)}>
              Other
            </button>
          )}
        </div>
      </section>
      <section className="panel panel-pad" style={{ padding: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2>Anything you don't like?</h2>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>We'll skip those too.</div>
        </div>
        <div className="toggles grid3">
          {TASTES.map((t) => (
            <button
              key={t}
              type="button"
              className="toggle"
              style={{ minHeight: 48 }}
              aria-pressed={nopes.includes(t)}
              onClick={() => setNopes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}
            >
              {TASTE_LABEL[t]}
            </button>
          ))}
        </div>
      </section>
      <div className="grow" />
      <button type="button" className="btn btn-primary" disabled={!info || info.full || !name.trim()} onClick={start}>
        Start swiping
      </button>
      <div className="small center">
        No app or account needed. Allergy info is a warning only, so check with your server too.
      </div>
    </main>
  );
}

/** Everyone: one dish at a time, "Not for me" or "I'd share this". */
export function Swipe({ code }: { code: string }) {
  const table = useTable();
  useEffect(() => {
    joinTable(code);
    loadTable(code).catch(() => {});
  }, [code]);

  if (table.connection === "gone") return <TableGone />;
  const me = table.members.find((m) => m.id === table.you);
  const info = table.code === code ? table.info : null;
  if (!info || !me) {
    return (
      <main className="screen">
        <div className="topbar" />
        <h1>Joining the table...</h1>
      </main>
    );
  }

  const { dishes, currency } = info.menu;
  const members = table.members;
  const others = members.filter((m) => m.id !== me.id && m.name);
  const deck = deckFor(dishes, me, members);
  const mine = new Set(table.swipes.filter((s) => s.userId === me.id).map((s) => s.dishId));
  const left = deck.filter((id) => !mine.has(id));
  const current = left[0];
  const dish = current !== undefined ? dishes[Number(current)] : null;
  const myMatches = table.matches.filter(
    (id) => dishes[Number(id)] && eatersOf(dishes[Number(id)], members).includes(me),
  );
  const latest =
    table.latestMatch !== null && myMatches.includes(table.latestMatch) ? dishes[Number(table.latestMatch)] : null;
  const latestWith = latest ? eatersOf(latest, others) : [];
  const stillSwiping = others.filter(
    (m) => table.swipes.filter((s) => s.userId === m.id).length < deckFor(dishes, m, members).length,
  );

  let note: string | null = null;
  if (dish && others.length) {
    const sharers = eatersOf(dish, others);
    const split = each(dish, currency, sharers.length + 1);
    const who =
      others.length === 1
        ? "Works for both of you"
        : sharers.length === others.length
          ? "Works for everyone"
          : `For you and ${listNames(sharers.map((m) => m.name))}`;
    note = `${who}${split ? `, ${split}` : ""}.`;
  }

  return (
    <main className="screen" style={{ gap: 14 }}>
      <div className="topbar">
        <BackButton fallback="/picks" label="Stop swiping" />
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Avatars members={members} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>{others.length ? youAnd(others) : "Waiting for them"}</span>
        </div>
        <div style={{ fontSize: 14, color: "var(--muted-strong)", minWidth: 44, textAlign: "right" }}>
          {Math.min(deck.length - left.length + 1, deck.length)} of {deck.length}
        </div>
      </div>

      {dish ? (
        <>
          <SwipeCard key={current} onSwipe={(liked) => swipe(current, liked)}>
            <div className="art">
              <Plate
                category={dish.category}
                size={200}
                label={`Drawing of ${CATEGORY_LABEL[dish.category].toLowerCase()}`}
              />
            </div>
            <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="dish-head">
                <h1 style={{ fontSize: 30, letterSpacing: -0.6 }}>{dish.name}</h1>
                <div style={{ fontSize: 20 }}>
                  <PriceCell dish={dish} currency={currency} />
                </div>
              </div>
              <div style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.4 }}>
                {[
                  dish.description && (/[.!?]$/.test(dish.description) ? dish.description : `${dish.description}.`),
                  note,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </div>
            </div>
          </SwipeCard>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ height: 56 }}
              onClick={() => swipe(current, false)}
            >
              Not for me
            </button>
            <button type="button" className="btn btn-primary" onClick={() => swipe(current, true)}>
              I'd share this
            </button>
          </div>
        </>
      ) : (
        <div className="panel panel-pad" style={{ padding: 20 }}>
          <h1 style={{ fontSize: 26 }}>That's every dish</h1>
          <p className="lede">
            {others.length === 0
              ? "Your tablemate hasn't joined yet."
              : stillSwiping.length
                ? `${listNames(stillSwiping.map((m) => m.name))} ${stillSwiping.length === 1 ? "is" : "are"} still swiping. Matches show up here as they happen.`
                : others.length === 1
                  ? "You've both finished."
                  : "Everyone's finished."}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate(`/split/${code}/matches`, { replace: true })}
          >
            See what you agree on
          </button>
        </div>
      )}

      {latest ? (
        <a
          className="match-banner"
          href={`/split/${code}/matches`}
          onClick={(e) => {
            e.preventDefault();
            dismissMatch();
            navigate(`/split/${code}/matches`);
          }}
          role="status"
        >
          <svg aria-hidden="true" width="34" height="34" viewBox="0 0 34 34" fill="none">
            <circle cx="17" cy="17" r="15" fill="#FFFFFF" />
            <path d="M9 18l5 5 11-12" stroke="#7A1F2B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 15, lineHeight: 1.3 }}>
            <b>
              {latestWith.length <= 1
                ? `You ${latestWith.length ? `and ${latestWith[0].name} ` : ""}both want the ${latest.name}.`
                : `${youAnd(latestWith)} all want the ${latest.name}.`}
            </b>
            <br />
            {myMatches.length === 1
              ? "That's your first match. See it"
              : `That's ${myMatches.length} dishes you agree on. See them`}
          </div>
        </a>
      ) : (
        myMatches.length > 0 && (
          <button
            type="button"
            className="link-btn"
            style={{ alignSelf: "center" }}
            onClick={() => navigate(`/split/${code}/matches`)}
          >
            See your {myMatches.length} {myMatches.length === 1 ? "match" : "matches"}
          </button>
        )
      )}
      {members.length < MAX_PEOPLE && (
        <button
          type="button"
          className="link-btn"
          style={{ alignSelf: "center" }}
          onClick={() => navigate(`/split/${code}`)}
        >
          Add someone to the table
        </button>
      )}
    </main>
  );
}

/** Everyone: the dishes you agree on, with one tap to add each to the order. */
export function Matches({ code }: { code: string }) {
  const table = useTable();
  const { items } = useOrder();
  useEffect(() => {
    joinTable(code);
    loadTable(code).catch(() => {});
  }, [code]);

  const info = table.code === code ? table.info : null;
  const me = table.members.find((m) => m.id === table.you);
  if (table.connection === "gone") return <TableGone />;
  if (!info || !me) {
    return (
      <main className="screen">
        <div className="topbar" />
        <h1>Loading your matches...</h1>
      </main>
    );
  }

  const { dishes, currency } = info.menu;
  const members = table.members;
  const others = members.filter((m) => m.id !== me.id && m.name);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name || "someone";
  const group = others.length > 1;
  const matches = table.matches.filter(
    (id) => dishes[Number(id)] && eatersOf(dishes[Number(id)], members).includes(me),
  );
  const nearly = almost(table.swipes, me.id).filter((a) => dishes[Number(a.dishId)]);
  const left = deckFor(dishes, me, members).filter(
    (id) => !table.swipes.some((s) => s.userId === me.id && s.dishId === id),
  );
  const together = group ? "Your table" : `You and ${others[0]?.name || "your tablemate"}`;

  return (
    <main className="screen" style={{ gap: 16 }}>
      <div className="topbar">
        <BackButton fallback={`/split/${code}/swipe`} label="Back to swiping" />
        <Avatars members={members} size={36} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1>
          {matches.length === 0
            ? `No matches yet`
            : `${together} ${group ? "agrees" : "agree"} on ${matches.length} ${matches.length === 1 ? "dish" : "dishes"}`}
        </h1>
        <p className="lede">
          {group
            ? "A shared dish is split between the people who can have it."
            : "Shared dishes count as half in your order."}
        </p>
      </div>

      {matches.length > 0 && (
        <div className="panel">
          {matches.map((id) => {
            const index = Number(id);
            const dish = dishes[index];
            const sharers = eatersOf(dish, members);
            const inOrder = items.some((i) => i.dish === index);
            const split = each(dish, currency, sharers.length);
            const price =
              split && dish.price !== null
                ? `${formatPrice(dish.price, currency)}, ${split}`
                : dish.price_status === "market_price"
                  ? "Market price"
                  : "No price listed";
            const without = members.filter((m) => m.name && !sharers.includes(m));
            return (
              <div className="row" key={id} style={{ cursor: "default", padding: "12px 14px 12px 10px" }}>
                <Plate category={dish.category} size={52} />
                <div className="row-main">
                  <div className="row-name" style={{ fontSize: 17 }}>
                    {dish.name}
                  </div>
                  <div className="row-sub">
                    {price}
                    {group && without.length > 0 ? `. Not for ${listNames(without.map((m) => m.name))}` : ""}
                  </div>
                </div>
                {inOrder ? (
                  <span className="tag-shared">In order</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ height: 44, padding: "0 14px" }}
                    onClick={() => addToOrder(index, { shared: true, shareWith: sharers.length })}
                  >
                    Add
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {nearly.length > 0 && (
        <div className="panel panel-pad" style={{ borderRadius: 18, gap: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {group
              ? "Almost: you liked these, someone passed"
              : `Almost: you liked these, ${others[0]?.name || "they"} passed`}
          </div>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>
            {nearly
              .map((a) =>
                group
                  ? `${dishes[Number(a.dishId)].name} (${listNames(a.passedBy.map(nameOf))})`
                  : dishes[Number(a.dishId)].name,
              )
              .join(", ")}
          </div>
        </div>
      )}

      <div className="grow" />
      <button type="button" className="btn btn-primary" onClick={() => navigate("/order")}>
        See our order
      </button>
      {left.length > 0 && (
        <button
          type="button"
          className="link-btn"
          style={{ alignSelf: "center" }}
          onClick={() => navigate(`/split/${code}/swipe`, { replace: true })}
        >
          Keep swiping, {left.length} {left.length === 1 ? "dish" : "dishes"} left
        </button>
      )}
    </main>
  );
}
