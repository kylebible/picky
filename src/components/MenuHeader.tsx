import { navigate } from "../lib/router";
import { Wordmark } from "./ui";

export type Tab = "picks" | "menu";

const TABS: { id: Tab; label: string; path: string }[] = [
  { id: "picks", label: "For you", path: "/picks" },
  { id: "menu", label: "Full menu", path: "/menu" },
];

export function MenuHeader({ title, tab }: { title: string; tab: Tab }) {
  const here = TABS.find((t) => t.id === tab)!.path;
  return (
    <>
      <div className="topbar">
        <Wordmark />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" className="link-btn" onClick={() => navigate("/snap")}>
            New menu
          </button>
          <button type="button" className="tastes-btn" onClick={() => navigate(`/setup/allergies?then=${here}`)}>
            Your tastes
          </button>
        </div>
      </div>
      <h1 style={{ fontSize: 28, letterSpacing: -0.6 }}>{title}</h1>
      <nav className="tabs" aria-label="Menu views">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={t.path}
            aria-current={t.id === tab ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              if (t.id !== tab) navigate(t.path, { replace: true });
            }}
          >
            {t.label}
          </a>
        ))}
      </nav>
    </>
  );
}
