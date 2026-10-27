import { useSyncExternalStore } from "react";
import { track } from "./telemetry";

// A tiny pathname router. Screens are few, and the Split it join link needs a
// real URL (/t/1234), so this uses the History API rather than a library.

const listeners = new Set<() => void>();
const notify = () => {
  track("page");
  listeners.forEach((l) => l());
};
window.addEventListener("popstate", notify);

export function navigate(path: string, { replace = false } = {}) {
  // `picky` marks entries we pushed, so back buttons know history.back() stays in the app.
  if (replace) history.replaceState({ picky: history.state?.picky ?? false }, "", path);
  else history.pushState({ picky: true }, "", path);
  window.scrollTo(0, 0);
  notify();
}

export function usePath() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => location.pathname,
  );
}
