import { useSyncExternalStore } from "react";
import type { ParsedMenuResponse } from "../../shared/menu";
import { remapOrderItems } from "./orderStore";
import { release, type MenuPhoto } from "./photos";

// The current menu and the read in progress. The parsed menu is kept in
// localStorage so a reload doesn't lose it; the photos only live in memory.

export const MAX_PAGES = 4;

type Reading =
  | { status: "idle" }
  | { status: "reading"; startedAt: number; pages: number }
  | { status: "error"; message: string };

type State = {
  menu: ParsedMenuResponse | null;
  photos: MenuPhoto[];
  reading: Reading;
};

const STORAGE_KEY = "picky.menu";

function loadMenu(): ParsedMenuResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let state: State = { menu: loadMenu(), photos: [], reading: { status: "idle" } };
let controller: AbortController | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useMenuStore() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** Sends the photos to be read. `strong` asks for the stronger model straight away. */
export async function readMenu(photos: MenuPhoto[], { strong = false } = {}) {
  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;
  if (photos !== state.photos) release(state.photos);
  set({ photos, reading: { status: "reading", startedAt: Date.now(), pages: photos.length } });

  const form = new FormData();
  photos.forEach((p, i) => form.append("photos", new File([p.blob], `page-${i + 1}.jpg`, { type: "image/jpeg" })));
  try {
    const res = await fetch(`/api/parse-menu${strong ? "?strong=1" : ""}`, {
      method: "POST",
      body: form,
      signal,
    }).catch((err) => {
      if (signal.aborted) throw err;
      throw new Error("We couldn't reach Picky. Check your connection and try again.");
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Something went wrong reading the menu.");
    const menu = body as ParsedMenuResponse;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(menu));
    } catch {
      // Storage full or blocked: the menu still works until the page reloads.
    }
    // A re-read of the same photos keeps the order, matching dishes by name;
    // a new menu starts a new one.
    const before = strong ? (state.menu?.menu.dishes ?? []) : [];
    remapOrderItems((i) => {
      const name = before[i]?.name.toLowerCase();
      return name ? menu.menu.dishes.findIndex((d) => d.name.toLowerCase() === name) : -1;
    });
    set({ menu, reading: { status: "idle" } });
    return true;
  } catch (err) {
    if (signal.aborted) return false;
    const message = err instanceof Error ? err.message : String(err);
    set({ reading: { status: "error", message } });
    return false;
  }
}

export function cancelReading() {
  controller?.abort();
  set({ reading: { status: "idle" } });
}
