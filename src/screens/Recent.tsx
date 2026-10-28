import { useEffect, useState } from "react";
import { BackButton } from "../components/ui";
import { openScan, recentScans, resumeScan, type RecentScan } from "../lib/menuStore";
import { navigate } from "../lib/router";
import { reportError } from "../lib/telemetry";

// Menus this phone read in the last while, kept on the server so they survive
// closing the app. Tapping one makes it the current menu again.

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function status(scan: RecentScan) {
  if (scan.status === "reading") return "Still reading";
  if (scan.status === "error") return "Couldn't read this one";
  return `${scan.dish_count ?? 0} ${scan.dish_count === 1 ? "dish" : "dishes"}`;
}

export function Recent() {
  const [scans, setScans] = useState<RecentScan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    recentScans()
      .then(setScans)
      .catch((err) => {
        reportError(err, "recent_load");
        setError("We couldn't load your recent menus. Check your connection and try again.");
      });
  }, []);

  async function open(scan: RecentScan) {
    if (scan.status === "reading") {
      resumeScan({ id: scan.id, startedAt: Date.parse(scan.created_at), pages: scan.pages, strong: false });
      navigate("/reading", { replace: true });
      return;
    }
    setOpening(scan.id);
    try {
      if (await openScan(scan.id)) navigate("/picks", { replace: true });
    } catch (err) {
      reportError(err, "recent_open");
      setError("We couldn't open that menu. Check your connection and try again.");
    } finally {
      setOpening(null);
    }
  }

  return (
    <main className="screen">
      <div className="topbar">
        <BackButton fallback="/" />
      </div>
      <h1>Recent menus</h1>
      {error && <div className="error-box">{error}</div>}
      {scans === null && !error && <p className="lede">Loading…</p>}
      {scans?.length === 0 && <div className="note">Menus you read show up here, so you can come back to them.</div>}
      {scans && scans.length > 0 && (
        <div className="panel" style={{ borderRadius: 18 }}>
          {scans.map((scan) => (
            <button
              key={scan.id}
              type="button"
              className="row"
              disabled={scan.status === "error" || opening !== null}
              onClick={() => open(scan)}
            >
              <div className="row-main">
                <div className="row-name">{scan.restaurant_name ?? "Menu"}</div>
                <div className="row-sub">
                  {when(scan.created_at)} · {status(scan)}
                </div>
              </div>
              {opening === scan.id && <span className="small">Opening…</span>}
            </button>
          ))}
        </div>
      )}
      <div className="grow" />
      <button type="button" className="btn btn-primary" onClick={() => navigate("/snap")}>
        Read a new menu
      </button>
    </main>
  );
}
