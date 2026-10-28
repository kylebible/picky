import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import type { MenuStreamEvent } from "../shared/menu";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      readonly ctx: unknown,
      readonly env: unknown,
    ) {}
  },
}));
let release = () => {};
vi.mock("./menu", async (original) => {
  const real = await original<typeof import("./menu")>();
  return {
    ...real,
    parseMenu: vi.fn(async (_env, _photos, _strong, send: (e: MenuStreamEvent) => void) => {
      send({ type: "menu", restaurant_name: "Cafe", currency: "USD" });
      send({ type: "checking" });
      await new Promise<void>((r) => (release = r));
      const menu = { restaurant_name: "Cafe", currency: "USD", dishes: [] };
      return { menu, model: "m", retried: true, usage: { input_tokens: 1, output_tokens: 2 } };
    }),
  };
});

const { MenuScan } = await import("./menu-scan");

/** A MenuScan backed by real SQLite, with D1 recorded rather than written. */
function make() {
  const db = new DatabaseSync(":memory:");
  const sql = {
    exec(query: string, ...args: (string | number)[]) {
      if (!args.length && query.includes(";")) {
        db.exec(query);
        return { toArray: () => [] };
      }
      const stmt = db.prepare(query);
      const rows = /^\s*SELECT/i.test(query) ? stmt.all(...args) : (stmt.run(...args), []);
      return { toArray: () => rows };
    },
  };
  const waits: Promise<unknown>[] = [];
  const ctx = {
    storage: { sql, setAlarm: async () => {}, deleteAll: async () => {} },
    blockConcurrencyWhile: (f: () => unknown) => f(),
    waitUntil: (p: Promise<unknown>) => waits.push(p),
  };
  const saved: string[] = [];
  const prepare = (q: string) => ({ bind: () => ({ q }), run: async () => ({}) });
  const env = { DB: { prepare, batch: async (s: { q: string }[]) => saved.push(...s.map((x) => x.q)) } };
  const scan = new MenuScan(ctx as never, env as never);
  return { scan, waits, saved };
}

const events = async (scan: InstanceType<typeof MenuScan>, from = 0) =>
  (await (await scan.fetch(new Request(`http://x/events?from=${from}`))).text())
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l))
    .filter((e) => e.type !== "ping");

const start = { id: "s1", photos: [], strong: false, deviceId: "d", appVersion: null };

describe("MenuScan", () => {
  it("streams live events to a listener and closes when the read ends", async () => {
    const { scan, waits, saved } = make();
    expect(await scan.start(start)).toBe(true);
    const live = events(scan);
    release();
    await Promise.all(waits);
    expect((await live).map((e) => [e.seq, e.type])).toEqual([
      [1, "menu"],
      [2, "checking"],
      [3, "done"],
    ]);
    // The menu is saved to D1 before the done event goes out.
    expect(saved.some((q) => q.includes("UPDATE scans"))).toBe(true);
    expect(saved.some((q) => q.includes("INSERT INTO menu_reads"))).toBe(true);
  });

  it("replays only what a reconnecting phone missed", async () => {
    const { scan, waits } = make();
    await scan.start(start);
    release();
    await Promise.all(waits);
    expect((await events(scan, 2)).map((e) => e.type)).toEqual(["done"]);
  });

  it("won't start the same scan twice", async () => {
    const { scan } = make();
    await scan.start(start);
    expect(await scan.start(start)).toBe(false);
  });
});
