import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { ALLERGENS, MenuSchema, type MenuStreamEvent } from "../shared/menu";
import { DIETS, TASTES } from "../shared/profile";
import { TABLE_CODE } from "../shared/split";
import { MAX_PHOTOS, MenuParseError, newTrace, parseMenu, toPhoto } from "./menu";

export { SplitSession } from "./split-session";

type AppEnv = { Bindings: Env; Variables: { userId: string } };

const app = new Hono<AppEnv>().basePath("/api");

// Anonymous device identity. Google sign-in (Better Auth) replaces this later.
app.use("*", async (c, next) => {
  let userId = getCookie(c, "picky_device");
  if (!userId) {
    userId = crypto.randomUUID();
    setCookie(c, "picky_device", userId, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  c.set("userId", userId);
  await next();
});

app.get("/health", (c) => c.json({ ok: true }));

const EventsSchema = z.object({
  session_id: z.string().max(40),
  app_version: z.string().max(40).optional(),
  events: z
    .array(
      z.object({
        kind: z.enum(["event", "error"]),
        name: z.string().max(64),
        path: z.string().max(200).optional(),
        at: z.string().max(40).optional(),
        data: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(50),
});

// Frontend observability: the app batches errors and key steps here, and they
// land in D1's client_events table for debugging.
app.post("/events", async (c) => {
  const parsed = EventsSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.body(null, 400);
  const { session_id, app_version, events } = parsed.data;
  const userAgent = c.req.header("user-agent")?.slice(0, 300) ?? null;
  const insert = c.env.DB.prepare(
    `INSERT INTO client_events (created_at, device_id, session_id, kind, name, path, data, app_version, user_agent)
     VALUES (coalesce(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const statements = events.map((e) => {
    if (e.kind === "error") console.error("client error", e.name, JSON.stringify(e.data ?? {}).slice(0, 2000));
    return insert.bind(
      e.at ?? null,
      c.get("userId"),
      session_id,
      e.kind,
      e.name,
      e.path ?? null,
      JSON.stringify(e.data ?? {}).slice(0, 8000),
      app_version ?? null,
      userAgent,
    );
  });
  // Keep two weeks; pruning on about 1 in 50 batches is plenty at this volume.
  if (Math.random() < 0.02) {
    statements.push(c.env.DB.prepare("DELETE FROM client_events WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-14 days')"));
  }
  if (statements.length) await c.env.DB.batch(statements);
  return c.body(null, 204);
});

// Bad uploads get a plain 400. Otherwise the reply streams newline-delimited
// MenuStreamEvents, so the phone can show dishes while the menu is still being read.
app.post("/parse-menu", async (c) => {
  let photos;
  try {
    const form = await c.req.formData();
    const files = form.getAll("photos").filter((f): f is File => f instanceof File);
    photos = await Promise.all(files.map(toPhoto));
    if (photos.length === 0) throw new MenuParseError("Add at least one photo");
    if (photos.length > MAX_PHOTOS) throw new MenuParseError(`Up to ${MAX_PHOTOS} photos per menu`);
  } catch (err) {
    if (err instanceof MenuParseError) return c.json({ error: err.message }, 400);
    throw err;
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const send = (event: MenuStreamEvent) => {
    writer.write(encoder.encode(JSON.stringify(event) + "\n")).catch(() => {});
  };
  // A careful read can go minutes without a dish to send; iOS Safari drops idle fetches.
  const ping = setInterval(() => send({ type: "ping" }), 5000);
  const trace = newTrace();
  const started = Date.now();
  const save = async (outcome: "done" | "error", result?: { model: string; retried: boolean }, error?: string) => {
    try {
      await c.env.DB.prepare(
        `INSERT INTO menu_reads (device_id, strong, pages, outcome, error, ms, final_model, retried, reasons, reads, app_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          c.get("userId"),
          trace.strong ? 1 : 0,
          photos.length,
          outcome,
          error ?? null,
          Date.now() - started,
          result?.model ?? null,
          result ? (result.retried ? 1 : 0) : null,
          JSON.stringify(trace.reasons),
          JSON.stringify(trace.reads),
          c.req.header("x-picky-version") ?? null,
        )
        .run();
    } catch (err) {
      console.error("saving menu read failed", err);
    }
  };
  c.executionCtx.waitUntil(
    parseMenu(c.env, photos, c.req.query("strong") === "1", send, trace)
      .then(
        async (result) => {
          // Save before the final event: once the response ends, unfinished work can be cancelled.
          await save("done", result);
          send({ type: "done", result });
        },
        async (err) => {
          if (!(err instanceof MenuParseError)) console.error("parse-menu failed", err);
          const known = err instanceof MenuParseError;
          const reason = String(err instanceof Error ? err.message : err).slice(0, 300);
          await save("error", undefined, reason);
          send({
            type: "error",
            message: known ? err.message : "Something went wrong reading the menu.",
            detail: known ? undefined : reason,
          });
        },
      )
      .finally(() => {
        clearInterval(ping);
        writer.close().catch(() => {});
      }),
  );
  return new Response(readable, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
});

const CreateTableSchema = z.object({
  menu: MenuSchema,
  name: z.string().trim().min(1).max(40),
  allergies: z.array(z.enum(ALLERGENS)),
  diet: z.enum(DIETS),
  nopes: z.array(z.enum(TASTES)).default([]),
  dislikes: z.array(z.string().max(40)).max(40).default([]),
});

const table = (env: Env, code: string) => env.SPLIT_SESSION.get(env.SPLIT_SESSION.idFromName(code));

// Split it tables use a 4-digit code people can type. Try random codes until
// one is free; with tables expiring after 12 hours, collisions are rare.
app.post("/tables", async (c) => {
  const parsed = CreateTableSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "That menu can't be shared" }, 400);
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(crypto.getRandomValues(new Uint16Array(1))[0] % 10000).padStart(4, "0");
    if (await table(c.env, code).create(c.get("userId"), parsed.data)) return c.json({ code });
  }
  return c.json({ error: "Couldn't find a free table code. Try again." }, 503);
});

app.get("/tables/:code", async (c) => {
  const code = c.req.param("code");
  if (!TABLE_CODE.test(code)) return c.json({ error: "Table codes are 4 digits" }, 400);
  const info = await table(c.env, code).info();
  return info ? c.json(info) : c.json({ error: "There's no table with that code" }, 404);
});

app.get("/tables/:code/ws", async (c) => {
  const code = c.req.param("code");
  if (!TABLE_CODE.test(code)) return c.json({ error: "Table codes are 4 digits" }, 400);
  const url = new URL(c.req.url);
  url.searchParams.set("userId", c.get("userId"));
  return table(c.env, code).fetch(new Request(url, c.req.raw));
});

export default app satisfies ExportedHandler<Env>;
