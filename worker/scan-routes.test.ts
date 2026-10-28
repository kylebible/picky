import { describe, expect, it, vi } from "vitest";

vi.mock("./split-session", () => ({ SplitSession: class {} }));
vi.mock("./menu-scan", () => ({ MenuScan: class {} }));

const { default: app } = await import("./index");

function env(owner: boolean) {
  const sqls: string[] = [];
  const started: unknown[] = [];
  const stmt = (sql: string) => ({
    bind: () => stmt(sql),
    run: async () => (sqls.push(sql), {}),
    first: async () => (owner ? { ok: 1 } : null),
  });
  const stub = {
    start: async (args: unknown) => (started.push(args), true),
    fetch: async () => new Response('{"type":"menu","seq":1}\n'),
  };
  const MENU_SCAN = { idFromName: (n: string) => n, get: () => stub };
  return { env: { DB: { prepare: stmt }, MENU_SCAN }, sqls, started };
}

const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} };

function post(files: File[], e: object) {
  const form = new FormData();
  files.forEach((f) => form.append("photos", f));
  return app.fetch(new Request("http://x/api/scans", { method: "POST", body: form }), e as never, ctx as never);
}

describe("scan routes", () => {
  it("starts a scan and returns its id", async () => {
    const { env: e, sqls, started } = env(true);
    const res = await post([new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" })], e);
    const { id } = (await res.json()) as { id: string };
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(sqls[0]).toContain("INSERT INTO scans");
    expect(started).toHaveLength(1);
  });

  it("rejects a request with no photos before starting", async () => {
    const { env: e, started } = env(true);
    const res = await post([], e);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Add at least one photo" });
    expect(started).toHaveLength(0);
  });

  it("only streams a scan's events to the phone that took it", async () => {
    const id = crypto.randomUUID();
    const url = `http://x/api/scans/${id}/events?from=0`;
    const mine = await app.fetch(new Request(url), env(true).env as never, ctx as never);
    expect(await mine.text()).toContain('"seq":1');
    const theirs = await app.fetch(new Request(url), env(false).env as never, ctx as never);
    expect(theirs.status).toBe(404);
  });
});
