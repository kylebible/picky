import { Wordmark } from "../components/ui";
import { navigate } from "../lib/router";

export function Welcome() {
  return (
    <main className="screen" style={{ paddingTop: 28 }}>
      <Wordmark large />
      <div className="grow" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg role="img" aria-label="Three plates of food on a table" width="100%" height="300" viewBox="0 0 330 300" fill="none" style={{ maxWidth: 330 }}>
          <circle cx="110" cy="120" r="82" fill="#F3D3C6" />
          <circle cx="232" cy="110" r="62" fill="#D5D6E4" />
          <circle cx="190" cy="216" r="70" fill="#EFDDB5" />
          <path d="M58 122h104c-3 24-24 38-52 38s-49-14-52-38z" fill="#FFFFFF" stroke="#2A1A18" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M70 120c5-13 16-8 21-16s14-10 21-2 16-6 22 2 14 6 18 16" stroke="#E8B04B" strokeWidth="5" strokeLinecap="round" />
          <path d="M198 112c9-11 24-12 36-4l11-8v24l-11-8c-12 8-27 7-36-4z" fill="#FFFFFF" stroke="#2A1A18" strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="207" cy="110" r="2" fill="#2A1A18" />
          <ellipse cx="190" cy="224" rx="50" ry="30" fill="#FFFFFF" stroke="#2A1A18" strokeWidth="2.5" />
          <circle cx="166" cy="226" r="10" fill="#E8604C" stroke="#2A1A18" strokeWidth="2" />
          <circle cx="214" cy="228" r="9" fill="#F28B3C" stroke="#2A1A18" strokeWidth="2" />
          <path d="M176 218c0-14 7-22 15-22s15 8 15 22c0 8-7 12-15 12s-15-4-15-12z" fill="#FBFAF6" stroke="#2A1A18" strokeWidth="2.2" />
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 }}>
        <h1 style={{ fontSize: 36, letterSpacing: -1 }}>Snap the menu. We'll point you to what you'll love.</h1>
        <p className="lede" style={{ fontSize: 17 }}>
          Then swipe with whoever you're eating with to find dishes to split.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button type="button" className="btn btn-primary" onClick={() => navigate("/snap")}>
          Snap a menu
        </button>
        <p className="small center" style={{ margin: "6px 0 0" }}>
          Picky flags likely allergens, but it can't promise a dish is safe. Always check with your server.
        </p>
      </div>
    </main>
  );
}
