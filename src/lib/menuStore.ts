import { useSyncExternalStore } from "react";
import { normalizeMenu, type Dish, type Menu, type MenuStreamEvent, type ParsedMenuResponse } from "../../shared/menu";
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

/** Reads the newline-delimited events from /api/scans/:id/events, calling `onEvent` for each. */
async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: MenuStreamEvent & { seq?: number }) => void) {
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
    if (!raw) return null;
    const saved = JSON.parse(raw) as ParsedMenuResponse;
    return { ...saved, menu: normalizeMenu(saved.menu) };
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

// The scan being read, so reopening the app picks it back up. The read runs on
// the server whether or not the app is open.
const SCAN_KEY = "picky.scan";
type PendingScan = { id: string; startedAt: number; pages: number; strong: boolean };
// After this long a saved scan is surely finished or lost; Recent menus still has it.
const RESUME_WITHIN_MS = 20 * 60 * 1000;

function savePending(scan: PendingScan | null) {
  try {
    if (scan) localStorage.setItem(SCAN_KEY, JSON.stringify(scan));
    else localStorage.removeItem(SCAN_KEY);
  } catch {
    // Storage blocked: the scan still finishes while the app stays open.
  }
}

function loadPending(): PendingScan | null {
  try {
    const scan = JSON.parse(localStorage.getItem(SCAN_KEY) ?? "null") as PendingScan | null;
    return scan && Date.now() - scan.startedAt < RESUME_WITHIN_MS ? scan : null;
  } catch {
    return null;
  }
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(id), resolve()), { once: true });
  });

/** Resolves once the app is in the foreground again; phones pause background fetches. */
const visible = (signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (document.visibilityState === "visible" || signal.aborted) return resolve();
    const done = () => {
      if (document.visibilityState !== "visible" && !signal.aborted) return;
      document.removeEventListener("visibilitychange", done);
      resolve();
    };
    document.addEventListener("visibilitychange", done);
    signal.addEventListener("abort", done, { once: true });
  });

/** Sends the photos to be read. `strong` asks for the stronger model straight away. */
export async function readMenu(photos: MenuPhoto[], { strong = false } = {}) {
  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;
  if (photos !== state.photos) release(state.photos);
  const startedAt = Date.now();
  track("read_start", { pages: photos.length, strong, bytes: photos.reduce((n, p) => n + p.blob.size, 0) });
  set({ photos, reading: { status: "reading", startedAt, pages: photos.length, dishes: [], currency: null, checking: false } });

  const form = new FormData();
  photos.forEach((p, i) => form.append("photos", new File([p.blob], `page-${i + 1}.jpg`, { type: "image/jpeg" })));
  let id: string;
  try {
    const res = await fetch(`/api/scans${strong ? "?strong=1" : ""}`, {
      method: "POST",
      body: form,
      headers: { "x-picky-version": __APP_VERSION__ },
      signal,
    }).catch((err) => {
      if (signal.aborted) throw err;
      throw new ReadError("We couldn't reach Picky. Check your connection and try again.", String(err));
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.id) throw new ReadError(body.error ?? "Something went wrong reading the menu.", `HTTP ${res.status}`);
    id = body.id;
  } catch (err) {
    return failed(err, signal, { stage: "upload", ms: Date.now() - startedAt, dishes: 0 });
  }
  const scan = { id, startedAt, pages: photos.length, strong };
  savePending(scan);
  return follow(scan, signal);
}

/**
 * Picks a scan back up: the one saved when the app was closed mid-read, or one
 * chosen from Recent menus that is still being read. Returns true if there was one.
 */
export function resumeScan(scan: PendingScan | null = loadPending()) {
  if (!scan || state.reading.status === "reading") return false;
  savePending(scan);
  controller?.abort();
  controller = new AbortController();
  track("read_resume", { ms: Date.now() - scan.startedAt });
  set({ reading: { status: "reading", startedAt: scan.startedAt, pages: scan.pages, dishes: [], currency: null, checking: false } });
  follow(scan, controller.signal);
  return true;
}

/**
 * Listens to a scan's events until it finishes, reconnecting from the last
 * event seen whenever the connection drops (the phone locked, the app went to
 * the background, the network changed). Only gives up after several tries in
 * a row that get nothing new.
 */
async function follow(scan: PendingScan, signal: AbortSignal) {
  const ms = () => Date.now() - scan.startedAt;
  let stage = "quick_reads";
  let seq = 0;
  let dishCount = 0;
  let failures = 0;
  let received = null as ParsedMenuResponse | null;
  try {
    while (!received) {
      await visible(signal);
      if (signal.aborted) throw new DOMException("cancelled", "AbortError");
      const before = seq;
      try {
        const res = await fetch(`/api/scans/${scan.id}/events?from=${seq}`, { signal, cache: "no-store" });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          if (res.status === 404) throw new ReadError("We lost track of that menu read. Try again.", "scan not found");
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        await readEvents(res.body, (event) => {
          if (signal.aborted) return;
          if (typeof event.seq === "number") seq = event.seq;
          if (event.type === "menu") updateReading({ currency: event.currency });
          else if (event.type === "dish" && state.reading.status === "reading") {
            if (++dishCount === 1) track("read_first_dish", { ms: ms() });
            updateReading({ dishes: [...state.reading.dishes, event.dish] });
          } else if (event.type === "checking") {
            stage = "careful_read";
            track("read_checking", { ms: ms(), dishes: dishCount });
            updateReading({ checking: true });
          } else if (event.type === "done") received = event.result;
          else if (event.type === "error") throw new ReadError(event.message, event.detail);
        });
        if (!received) throw new Error("stream ended early");
      } catch (err) {
        if (signal.aborted || err instanceof ReadError) throw err;
        failures = seq > before ? 1 : failures + 1;
        track("read_reconnect", { ms: ms(), stage, seq, failures, reason: String(err).slice(0, 200), visibility: document.visibilityState });
        if (failures >= 6) throw new ReadError("We lost the connection while reading the menu. It'll be in Recent menus when it's done.", String(err));
        await wait(Math.min(1000 * 2 ** (failures - 1), 8000), signal);
      }
    }
  } catch (err) {
    return failed(err, signal, { stage, ms: ms(), dishes: dishCount });
  }
  const menu = received;
  savePending(null);
  track("read_done", { ms: ms(), dishes: menu.menu.dishes.length, model: menu.model, retried: menu.retried, usage: menu.usage });
  applyScan(menu, scan.strong);
  set({ reading: { status: "idle" } });
  return true;
}

function failed(err: unknown, signal: AbortSignal, data: { stage: string; ms: number; dishes: number }) {
  if (signal.aborted) {
    track("read_cancel", data);
    return false;
  }
  savePending(null);
  const message = err instanceof Error ? err.message : String(err);
  const detail = err instanceof ReadError ? err.detail : undefined;
  reportError(err, "read_error", { ...data, detail, visibility: document.visibilityState });
  set({ reading: { status: "error", message, detail } });
  return false;
}

/** Makes a finished scan the current menu. */
function applyScan(menu: ParsedMenuResponse, reread: boolean) {
  // A re-read of the same photos keeps the order, matching dishes by name;
  // a new menu starts a new one.
  const before = reread ? (state.menu?.menu.dishes ?? []) : [];
  remapOrderItems((i) => {
    const name = before[i]?.name.toLowerCase();
    return name ? menu.menu.dishes.findIndex((d) => d.name.toLowerCase() === name) : -1;
  });
  if (!reread) forgetTable();
  saveMenu({ ...menu, menu: normalizeMenu(menu.menu) });
}

export type RecentScan = {
  id: string;
  created_at: string;
  status: "reading" | "done" | "error";
  pages: number;
  restaurant_name: string | null;
  dish_count: number | null;
  error: string | null;
};

/** This phone's recent scans, newest first. */
export async function recentScans(): Promise<RecentScan[]> {
  const res = await fetch("/api/scans", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).scans;
}

/** Opens a past scan as the current menu. Returns false if it has no menu. */
export async function openScan(id: string) {
  const res = await fetch(`/api/scans/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const scan = (await res.json()) as RecentScan & { result: ParsedMenuResponse | null };
  if (!scan.result) return false;
  if (state.menu && JSON.stringify(state.menu.menu) === JSON.stringify(normalizeMenu(scan.result.menu))) return true;
  track("scan_open", { age_ms: Date.now() - Date.parse(scan.created_at) });
  applyScan(scan.result, false);
  return true;
}

export function cancelReading() {
  controller?.abort();
  savePending(null);
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
export function adoptMenu(shared: Menu) {
  const menu = normalizeMenu(shared);
  if (state.menu && JSON.stringify(state.menu.menu) === JSON.stringify(menu)) return;
  remapOrderItems(() => -1);
  saveMenu({ menu, model: "shared", retried: false, usage: { input_tokens: 0, output_tokens: 0 } });
}
