import { useSyncExternalStore } from "react";
import type { Dish, Menu, MenuStreamEvent, ParsedMenuResponse } from "../../shared/menu";
import { remapOrderItems } from "./orderStore";
import { release, type MenuPhoto } from "./photos";
import { forgetTable } from "./tableStore";
import { reportError, track } from "./telemetry";

// The current menu and the read in progress. The parsed menu is kept in
// localStorage so a reload doesn't lose it; the photos only live in memory.

export const MAX_PAGES = 4;

type Reading =
  | { status: "idle" }
  | {
      status: "reading";
      startedAt: number;
      pages: number;
      // Dishes from the first read, shown while the menu is still being read.
      dishes: Dish[];
      currency: string | null;
      // The quick reads disagreed and a slower careful read is running.
      checking: boolean;
    }
  | { status: "error"; message: string; detail?: string };

class ReadError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
  }
}

/** Reads the newline-delimited events from /api/parse-menu, calling `onEvent` for each. */
async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: MenuStreamEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffered += decoder.decode(value, { stream: !done });
    const lines = buffered.split("\n");
    buffered = done ? "" : lines.pop()!;
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
    if (done) return;
  }
}

function updateReading(patch: Partial<Extract<Reading, { status: "reading" }>>) {
  if (state.reading.status === "reading") set({ reading: { ...state.reading, ...patch } });
}

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
  const startedAt = Date.now();
  const ms = () => Date.now() - startedAt;
  let stage = "upload";
  let dishCount = 0;
  track("read_start", { pages: photos.length, strong, bytes: photos.reduce((n, p) => n + p.blob.size, 0) });
  set({
    photos,
    reading: {
      status: "reading",
      startedAt,
      pages: photos.length,
      dishes: [],
      currency: null,
      checking: false,
    },
  });

  const form = new FormData();
  photos.forEach((p, i) => form.append("photos", new File([p.blob], `page-${i + 1}.jpg`, { type: "image/jpeg" })));
  try {
    const res = await fetch(`/api/parse-menu${strong ? "?strong=1" : ""}`, {
      method: "POST",
      body: form,
      headers: { "x-picky-version": __APP_VERSION__ },
      signal,
    }).catch((err) => {
      if (signal.aborted) throw err;
      throw new Error("We couldn't reach Picky. Check your connection and try again.");
    });
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      throw new ReadError(body.error ?? "Something went wrong reading the menu.", `HTTP ${res.status}`);
    }
    // Assigned inside the callback, so TypeScript is told the type rather than inferring null.
    stage = "quick_reads";
    let received = null as ParsedMenuResponse | null;
    await readEvents(res.body, (event) => {
      if (signal.aborted) return;
      if (event.type === "menu") updateReading({ currency: event.currency });
      else if (event.type === "dish" && state.reading.status === "reading") {
        if (++dishCount === 1) track("read_first_dish", { ms: ms() });
        updateReading({ dishes: [...state.reading.dishes, event.dish] });
      } else if (event.type === "checking") {
        stage = "careful_read";
        track("read_checking", { ms: ms(), dishes: dishCount });
        updateReading({ checking: true });
      }
      else if (event.type === "done") received = event.result;
      else if (event.type === "error") throw new ReadError(event.message, event.detail);
    }).catch((err) => {
      if (signal.aborted || err instanceof ReadError) throw err;
      throw new ReadError("We lost the connection while reading the menu. Try again.", String(err));
    });
    const menu = received;
    if (!menu) throw new ReadError("The menu read stopped before it finished. Try again.");
    stage = "save";
    track("read_done", {
      ms: ms(),
      dishes: menu.menu.dishes.length,
      model: menu.model,
      retried: menu.retried,
      usage: menu.usage,
    });
    // A re-read of the same photos keeps the order, matching dishes by name;
    // a new menu starts a new one.
    const before = strong ? (state.menu?.menu.dishes ?? []) : [];
    remapOrderItems((i) => {
      const name = before[i]?.name.toLowerCase();
      return name ? menu.menu.dishes.findIndex((d) => d.name.toLowerCase() === name) : -1;
    });
    if (!strong) forgetTable();
    saveMenu(menu);
    set({ reading: { status: "idle" } });
    return true;
  } catch (err) {
    if (signal.aborted) {
      track("read_cancel", { ms: ms(), stage, dishes: dishCount });
      return false;
    }
    const message = err instanceof Error ? err.message : String(err);
    reportError(err, "read_error", {
      ms: ms(),
      stage,
      dishes: dishCount,
      detail: err instanceof ReadError ? err.detail : undefined,
      visibility: document.visibilityState,
    });
    set({ reading: { status: "error", message, detail: err instanceof ReadError ? err.detail : undefined } });
    return false;
  }
}

export function cancelReading() {
  controller?.abort();
  set({ reading: { status: "idle" } });
}

function saveMenu(menu: ParsedMenuResponse) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(menu));
  } catch {
    // Storage full or blocked: the menu still works until the page reloads.
  }
  set({ menu });
}

/** Uses a menu someone else read, for a tablemate joining a Split it table. */
export function adoptMenu(menu: Menu) {
  if (state.menu && JSON.stringify(state.menu.menu) === JSON.stringify(menu)) return;
  remapOrderItems(() => -1);
  saveMenu({ menu, model: "shared", retried: false, usage: { input_tokens: 0, output_tokens: 0 } });
}
