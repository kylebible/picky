import { useSyncExternalStore } from "react";
import type { Swipe } from "../../shared/match";
import type { Allergen, Diet } from "../../shared/profile";
import type { ClientMessage, Member, ServerMessage, TableInfo } from "../../shared/split";

// The Split it table this phone is at, and its live connection. The code is
// remembered so a reload or a locked phone can pick up where it left off.

type Connection = "idle" | "connecting" | "open" | "closed" | "gone";

type State = {
  code: string | null;
  info: TableInfo | null;
  connection: Connection;
  you: string | null;
  members: Member[];
  swipes: Swipe[];
  matches: string[];
  /** The newest match, for the banner on the swipe screen. */
  latestMatch: string | null;
  error: string | null;
};

const KEY = "picky.table";
const EMPTY: State = {
  code: null,
  info: null,
  connection: "idle",
  you: null,
  members: [],
  swipes: [],
  matches: [],
  latestMatch: null,
  error: null,
};

function savedCode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let state: State = { ...EMPTY, code: savedCode() };
let socket: WebSocket | null = null;
let retry = 0;
let hello: ClientMessage | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useTable() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init).catch(() => {
    throw new Error("We couldn't reach Picky. Check your connection and try again.");
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
  return body as T;
}

/** Creates a table for the current menu and returns its code. */
export async function createTable(body: {
  menu: TableInfo["menu"];
  name: string;
  allergies: Allergen[];
  diet: Diet;
}): Promise<string> {
  const { code } = await api<{ code: string }>("/api/tables", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  remember(code);
  return code;
}

function remember(code: string) {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // Not remembered across reloads, but the table still works.
  }
}

/** Loads what's on a table. Throws with a readable message when there's no such table. */
export async function loadTable(code: string): Promise<TableInfo> {
  if (state.code === code && state.info) return state.info;
  const info = await api<TableInfo>(`/api/tables/${code}`);
  set({ code, info });
  return info;
}

/** Connects to the table. A tablemate passes their name and allergies to introduce themselves. */
export function joinTable(code: string, intro?: Extract<ClientMessage, { type: "hello" }>) {
  if (intro) hello = intro;
  remember(code);
  if (state.code !== code) set({ ...EMPTY, code });
  if (socket && state.code === code && state.connection !== "closed") return;
  connect(code);
}

function connect(code: string) {
  socket?.close();
  set({ connection: "connecting", error: null });
  const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/tables/${code}/ws`);
  socket = ws;
  ws.onopen = () => {
    retry = 0;
    set({ connection: "open" });
    if (hello) ws.send(JSON.stringify(hello));
  };
  ws.onmessage = (ev) => {
    const message = JSON.parse(ev.data) as ServerMessage;
    if (message.type === "state") {
      set({ you: message.you, members: message.members, swipes: message.swipes, matches: message.matches });
    } else if (message.type === "match") {
      set({ latestMatch: message.dishId });
    } else if (message.type === "error") {
      set({ error: message.message });
    }
  };
  ws.onclose = (ev) => {
    if (socket !== ws) return;
    socket = null;
    // 1000 is the table closing itself; a failed upgrade (full or expired) never opens.
    if (ev.code === 1000 || (state.connection === "connecting" && retry >= 3)) {
      set({ connection: "gone" });
      return;
    }
    set({ connection: "closed" });
    const delay = Math.min(10000, 500 * 2 ** retry++);
    setTimeout(() => state.code === code && !socket && connect(code), delay);
  };
}

export function swipe(dishId: string, liked: boolean) {
  if (!state.you) return;
  // Show it straight away; the table's next state confirms it.
  set({
    swipes: [
      ...state.swipes.filter((s) => !(s.userId === state.you && s.dishId === dishId)),
      { userId: state.you, dishId, liked },
    ],
  });
  socket?.send(JSON.stringify({ type: "swipe", dishId, liked } satisfies ClientMessage));
}

export const dismissMatch = () => set({ latestMatch: null });

/** Leaves the table on this phone, for when a new menu is read. */
export function forgetTable() {
  socket?.close();
  socket = null;
  hello = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
  set({ ...EMPTY });
}
