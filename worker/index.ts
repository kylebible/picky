import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { ALLERGENS, MenuSchema, type MenuStreamEvent } from "../shared/menu";
import { DIETS } from "../shared/profile";
import { TABLE_CODE } from "../shared/split";
import { MAX_PHOTOS, MenuParseError, parseMenu, toPhoto } from "./menu";

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

// Crashes reported by the app, so they show up in Workers Logs.
app.post("/client-error", async (c) => {
  const report = (await c.req.text()).slice(0, 4000);
  console.error("client error", report);
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
  c.executionCtx.waitUntil(
    parseMenu(c.env, photos, c.req.query("strong") === "1", send)
      .then((result) => send({ type: "done", result }))
      .catch((err) => {
        if (!(err instanceof MenuParseError)) console.error("parse-menu failed", err);
        const known = err instanceof MenuParseError;
        send({
          type: "error",
          message: known ? err.message : "Something went wrong reading the menu.",
          detail: known ? undefined : String(err instanceof Error ? err.message : err).slice(0, 300),
        });
      })
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
