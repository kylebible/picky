import { useEffect, useState } from "react";
import { cancelReading, readMenu, useMenuStore } from "../lib/menuStore";
import { navigate } from "../lib/router";

// Most reads take 10 to 20 seconds. When the two quick reads disagree the menu
// gets a slower careful read, which can take a few minutes on a dense menu.
// The bar eases toward 60% over the quick read, then creeps toward 90% over the
// careful one, and only fills when the menu arrives, so it never claims to be done.
const EXPECTED_MS = 15000;
const CAREFUL_MS = 90000;
const SLOW_AFTER_MS = 30000;

function useProgress(startedAt: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [startedAt]);
  if (startedAt === null) return { progress: 0, slow: false };
  const elapsed = now - startedAt;
  const quick = 60 * (1 - Math.exp((-2 * elapsed) / EXPECTED_MS));
  const careful = 30 * (1 - Math.exp(-elapsed / CAREFUL_MS));
  return { progress: Math.round(quick + careful), slow: elapsed > SLOW_AFTER_MS };
}

export function Reading() {
  const { reading, photos, menu } = useMenuStore();
  const { progress, slow } = useProgress(reading.status === "reading" ? reading.startedAt : null);

  useEffect(() => {
    // Done: the store went back to idle with a menu.
    if (reading.status === "idle") navigate(menu ? "/menu" : "/snap", { replace: true });
  }, [reading.status, menu]);

  if (reading.status === "error") {
    return (
      <main className="screen">
        <div className="topbar" />
        <h1>We couldn't read that menu</h1>
        <div className="error-box">{reading.message}</div>
        <div className="grow" />
        {photos.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={() => readMenu(photos)}>
            Try again
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => navigate("/snap", { replace: true })}>
          Take new photos
        </button>
      </main>
    );
  }

  const pages = reading.status === "reading" ? reading.pages : 1;

  return (
    <main className="screen">
      <div className="topbar" style={{ justifyContent: "flex-end" }}>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            cancelReading();
            navigate("/snap", { replace: true });
          }}
        >
          Cancel
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1>Reading your menu</h1>
        <p className="lede">
          {slow
            ? "This is a big menu, so we're taking a closer look. That can take a few minutes."
            : `${pages > 1 ? `Reading ${pages} pages. ` : ""}This usually takes 10 to 20 seconds.`}
        </p>
        <div
          className="progress"
          role="progressbar"
          aria-label="Reading the menu"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          style={{ marginTop: 4 }}
        >
          <div style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="panel" aria-hidden="true">
        {[60, 48, 66, 52, 40].map((w, i) => (
          <div className="skeleton-row" key={i}>
            <span className="bar" style={{ width: 44, height: 44, borderRadius: 22 }} />
            <span style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="bar" style={{ height: 12, width: `${w}%` }} />
              <span className="bar" style={{ height: 10, width: `${w / 2}%`, background: "#F6EEEC" }} />
            </span>
          </div>
        ))}
      </div>
      <div className="grow" />
      <div className="note">
        While you wait: we'll mark anything we're unsure about, like a missing price, so you know what to ask.
      </div>
    </main>
  );
}
