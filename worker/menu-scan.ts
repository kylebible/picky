import { DurableObject } from "cloudflare:workers";
import type { MenuStreamEvent, ParsedMenuResponse } from "../shared/menu";
import { MenuParseError, newTrace, parseMenu, type Photo } from "./menu";

// One instance per menu scan. The read runs here rather than in the request
// that uploaded the photos, so it keeps going when the phone locks or the app
// is closed. Every event is kept in this object's SQLite storage with a
// sequence number, so a phone that reconnects replays what it missed with
// GET /events?from=<last seq>. The photos only live in memory while the read
// runs. The finished menu is saved to D1's scans table; this object wipes
// itself a day later.

export const SCAN_TTL_MS = 24 * 60 * 60 * 1000;
// A read that hasn't finished by then was lost (the object restarted mid-read).
const STUCK_AFTER_MS = 15 * 60 * 1000;
const PING_MS = 5000;

export type ScanStart = { id: string; photos: Photo[]; strong: boolean; deviceId: string; appVersion: string | null };
export type ScanEvent = MenuStreamEvent & { seq: number };

const finished = (e: MenuStreamEvent) => e.type === "done" || e.type === "error";

export class MenuScan extends DurableObject<Env> {
  private listeners = new Set<(line: string) => void>();
  private closers = new Set<() => void>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY, body TEXT NOT NULL);
      `);
    });
  }

  private meta(key: string): string | null {
    return this.ctx.storage.sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = ?", key).toArray()[0]?.value ?? null;
  }

  private setMeta(key: string, value: string) {
    this.ctx.storage.sql.exec("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", key, value);
  }

  private isFinished() {
    return this.meta("status") !== "reading";
  }

  /** Stores the event and hands it to every phone listening. Pings aren't stored. */
  private emit(event: MenuStreamEvent) {
    if (event.type === "ping") return;
    const seq = Number(this.meta("seq") ?? 0) + 1;
    const body = JSON.stringify({ ...event, seq } satisfies ScanEvent);
    this.ctx.storage.sql.exec("INSERT INTO events (seq, body) VALUES (?, ?)", seq, body);
    this.setMeta("seq", String(seq));
    for (const listen of this.listeners) listen(body + "\n");
    if (finished(event)) for (const close of this.closers) close();
  }

  /** Starts the read. Returns false if this scan id was already used. */
  async start({ id, photos, strong, deviceId, appVersion }: ScanStart): Promise<boolean> {
    if (this.meta("status")) return false;
    this.setMeta("id", id);
    this.setMeta("status", "reading");
    await this.ctx.storage.setAlarm(Date.now() + STUCK_AFTER_MS);
    // Not awaited: the uploading request returns at once. An outbound fetch in
    // flight keeps this object running until the read ends.
    this.ctx.waitUntil(this.run(id, photos, strong, deviceId, appVersion));
    return true;
  }

  private async run(id: string, photos: Photo[], strong: boolean, deviceId: string, appVersion: string | null) {
    const trace = newTrace();
    const started = Date.now();
    let outcome: "done" | "error" = "error";
    let result: ParsedMenuResponse | undefined;
    let error: string | undefined;
    let final: MenuStreamEvent;
    try {
      result = await parseMenu(this.env, photos, strong, (e) => this.emit(e), trace);
      outcome = "done";
      final = { type: "done", result };
    } catch (err) {
      if (!(err instanceof MenuParseError)) console.error("menu scan failed", err);
      const known = err instanceof MenuParseError;
      error = String(err instanceof Error ? err.message : err).slice(0, 300);
      final = {
        type: "error",
        message: known ? err.message : "Something went wrong reading the menu.",
        detail: known ? undefined : error,
      };
    }
    photos.length = 0;
    try {
      await this.env.DB.batch([
        this.env.DB.prepare(
          `UPDATE scans SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), restaurant_name = ?,
             dish_count = ?, model = ?, retried = ?, error = ?, result = ?
           WHERE id = ?`,
        ).bind(
          outcome,
          result?.menu.restaurant_name ?? null,
          result?.menu.dishes.length ?? null,
          result?.model ?? null,
          result ? (result.retried ? 1 : 0) : null,
          final.type === "error" ? final.message : null,
          result ? JSON.stringify(result) : null,
          id,
        ),
        this.env.DB.prepare(
          `INSERT INTO menu_reads (device_id, strong, pages, outcome, error, ms, final_model, retried, reasons, reads, app_version, scan_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          deviceId,
          trace.strong ? 1 : 0,
          trace.pages,
          outcome,
          error ?? null,
          Date.now() - started,
          result?.model ?? null,
          result ? (result.retried ? 1 : 0) : null,
          JSON.stringify(trace.reasons),
          JSON.stringify(trace.reads),
          appVersion,
          id,
        ),
      ]);
    } catch (err) {
      console.error("saving menu scan failed", err);
    }
    this.setMeta("status", outcome);
    this.emit(final);
    await this.ctx.storage.setAlarm(Date.now() + SCAN_TTL_MS);
  }

  async alarm() {
    if (this.meta("status") === "reading") {
      // The object restarted mid-read and the photos are gone with it.
      const message = "The menu read stopped before it finished. Try again.";
      const id = this.meta("id");
      if (id) {
        await this.env.DB.prepare(
          "UPDATE scans SET status = 'error', error = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'reading'",
        )
          .bind(message, id)
          .run()
          .catch((err) => console.error("marking stuck scan failed", err));
      }
      this.setMeta("status", "error");
      this.emit({ type: "error", message, detail: "scan stopped" });
      await this.ctx.storage.setAlarm(Date.now() + SCAN_TTL_MS);
      return;
    }
    await this.ctx.storage.deleteAll();
  }

  /** GET /events?from=N streams newline-delimited ScanEvents after seq N, then live ones until the scan ends. */
  async fetch(request: Request): Promise<Response> {
    const from = Number(new URL(request.url).searchParams.get("from") ?? 0) || 0;
    if (!this.meta("status")) return Response.json({ error: "There's no scan with that id" }, { status: 404 });

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const write = (line: string) => writer.write(encoder.encode(line)).catch(() => cleanup());
    const rows = this.ctx.storage.sql.exec<{ body: string }>("SELECT body FROM events WHERE seq > ? ORDER BY seq", from).toArray();
    for (const r of rows) write(r.body + "\n");

    let ping: ReturnType<typeof setInterval> | undefined;
    const cleanup = () => {
      clearInterval(ping);
      this.listeners.delete(write);
      this.closers.delete(cleanup);
      writer.close().catch(() => {});
    };
    if (this.isFinished()) {
      cleanup();
    } else {
      this.listeners.add(write);
      this.closers.add(cleanup);
      // A careful read can go minutes without an event; iOS Safari drops idle fetches.
      ping = setInterval(() => write(JSON.stringify({ type: "ping" }) + "\n"), PING_MS);
      request.signal?.addEventListener("abort", cleanup);
    }
    return new Response(readable, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
    });
  }
}
