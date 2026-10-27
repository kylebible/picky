import { describe, expect, it, vi } from "vitest";
import type { MenuStreamEvent } from "../shared/menu";

vi.mock("./split-session", () => ({ SplitSession: class {} }));
vi.mock("./menu", async (original) => {
  const real = await original<typeof import("./menu")>();
  return {
    ...real,
    parseMenu: vi.fn(async (_env, _photos, _strong, send: (e: MenuStreamEvent) => void) => {
      send({ type: "menu", restaurant_name: "Cafe", currency: "USD" });
      send({ type: "checking" });
      const menu = { restaurant_name: "Cafe", currency: "USD", dishes: [] };
      return { menu, model: "m", retried: true, usage: { input_tokens: 1, output_tokens: 2 } };
    }),
  };
});

const { default: app } = await import("./index");

function post(files: File[]) {
  const form = new FormData();
  files.forEach((f) => form.append("photos", f));
  const waits: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => waits.push(p), passThroughOnException() {}, props: {} };
  return app.fetch(new Request("http://x/api/parse-menu", { method: "POST", body: form }), {} as Env, ctx as never);
}

describe("POST /api/parse-menu", () => {
  it("streams events as lines of JSON", async () => {
    const res = await post([new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" })]);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const events = (await res.text()).trim().split("\n").map((l) => JSON.parse(l).type);
    expect(events).toEqual(["menu", "checking", "done"]);
  });

  it("rejects a request with no photos before streaming", async () => {
    const res = await post([]);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Add at least one photo" });
  });
});
