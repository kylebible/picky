/** Sends a crash to the Worker, which logs it so it shows up in Workers Logs. */
export function reportError(error: unknown, where: string) {
  const err = error instanceof Error ? error : new Error(String(error));
  const body = JSON.stringify({
    where,
    message: err.message,
    stack: err.stack?.slice(0, 2000),
    path: location.pathname,
    userAgent: navigator.userAgent,
  });
  try {
    navigator.sendBeacon("/api/client-error", new Blob([body], { type: "application/json" }));
  } catch {
    // Reporting is best effort.
  }
}

/** Forgets the current menu, order and table but keeps the person's tastes. */
export function startOver() {
  for (const key of ["picky.menu", "picky.order", "picky.table"]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage blocked: nothing saved to clear.
    }
  }
  location.replace("/");
}
