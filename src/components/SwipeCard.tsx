import { useRef, useState, type ReactNode } from "react";

// A card you can drag left (pass) or right (share). Past the threshold, or on a
// quick flick, it flies off and reports the choice; otherwise it springs back.
// The buttons under the card stay, for anyone who'd rather tap.

const THRESHOLD = 90;
const FLICK_SPEED = 0.6; // px per ms

export function SwipeCard({ onSwipe, children }: { onSwipe: (liked: boolean) => void; children: ReactNode }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<null | boolean>(null);
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);

  function release(e: React.PointerEvent) {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (!s || !horizontal.current) {
      setDx(0);
      return;
    }
    const speed = Math.abs(dx) / Math.max(1, e.timeStamp - s.t);
    if (Math.abs(dx) > THRESHOLD || (Math.abs(dx) > 30 && speed > FLICK_SPEED)) {
      const liked = dx > 0;
      setLeaving(liked);
      setTimeout(() => onSwipe(liked), 180);
    } else {
      setDx(0);
    }
  }

  const x = leaving === null ? dx : leaving ? window.innerWidth : -window.innerWidth;
  const strength = Math.min(1, Math.abs(dx) / THRESHOLD);

  return (
    <article
      className={`swipe-card${dragging ? " dragging" : ""}`}
      style={{
        transform: `translateX(${x}px) rotate(${-1.5 + x / 20}deg)`,
        transition: dragging ? "none" : "transform 0.2s ease-out",
      }}
      onPointerDown={(e) => {
        if (leaving !== null || e.button !== 0) return;
        start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
        horizontal.current = null;
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        const mx = e.clientX - s.x;
        const my = e.clientY - s.y;
        // Decide once whether this is a swipe or a scroll, so the page can still scroll.
        if (horizontal.current === null) {
          if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
          horizontal.current = Math.abs(mx) > Math.abs(my);
          if (!horizontal.current) {
            start.current = null;
            return;
          }
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }
        setDx(mx);
      }}
      onPointerUp={release}
      onPointerCancel={() => {
        start.current = null;
        setDragging(false);
        setDx(0);
      }}
    >
      {dx !== 0 && (
        <span className={`swipe-stamp ${dx > 0 ? "share" : "pass"}`} style={{ opacity: strength }} aria-hidden="true">
          {dx > 0 ? "Share" : "Pass"}
        </span>
      )}
      {children}
    </article>
  );
}
