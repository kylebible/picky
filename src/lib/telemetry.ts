// Frontend observability: errors and key steps are batched to /api/events and
// stored in D1 (client_events), where Claude can query them. Never send
// allergies, profile details or menu text here, only names, counts and timings.

type ClientEvent = {
  kind: "event" | "error";
  name: string;
  path: string;
  at: string;
  data: Record<string, unknown>;
};

const SESSION_ID = Math.random().toString(36).slice(2, 10);
const queue: ClientEvent[] = [];
// The last few steps, attached to error reports so they show what led up to them.
const breadcrumbs: string[] = [];

function enqueue(kind: ClientEvent["kind"], name: string, data: Record<string, unknown>) {
  queue.push({ kind, name, path: location.pathname, at: new Date().toISOString(), data });
  if (kind === "error" || queue.length >= 20) flush();
}

/** Records a step, such as a page view or a menu-read stage. */
export function track(name: string, data: Record<string, unknown> = {}) {
  breadcrumbs.push(`${new Date().toISOString().slice(11, 19)} ${name} ${location.pathname}`);
  if (breadcrumbs.length > 15) breadcrumbs.shift();
  enqueue("event", name, data);
}

/** Records an error with its stack and the steps before it, and sends it straight away. */
export function reportError(error: unknown, where: string, data: Record<string, unknown> = {}) {
  const err = error instanceof Error ? error : new Error(String(error));
  enqueue("error", where, {
    ...data,
    message: err.message.slice(0, 500),
    stack: err.stack?.slice(0, 2000),
    breadcrumbs: [...breadcrumbs],
  });
}

export function flush() {
  if (!queue.length) return;
  const body = JSON.stringify({ session_id: SESSION_ID, app_version: __APP_VERSION__, events: queue.splice(0) });
  try {
    navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
  } catch {
    // Reporting is best effort.
  }
}

setInterval(flush, 5000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flush();
});

/** Forgets the current menu, order and table but keeps the person's tastes. */
export function startOver() {
  track("start_over");
  flush();
  for (const key of ["picky.menu", "picky.order", "picky.table"]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage blocked: nothing saved to clear.
    }
  }
  location.replace("/");
}
