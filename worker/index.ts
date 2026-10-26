import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { MenuParseError, parseMenu, toPhoto } from "./menu";

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

app.post("/parse-menu", async (c) => {
  try {
    const form = await c.req.formData();
    const files = form.getAll("photos").filter((f): f is File => f instanceof File);
    const photos = await Promise.all(files.map(toPhoto));
    return c.json(await parseMenu(c.env, photos));
  } catch (err) {
    if (err instanceof MenuParseError) return c.json({ error: err.message }, 400);
    throw err;
  }
});

const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

app.post("/sessions", (c) => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(bytes, (b) => JOIN_CODE_CHARS[b % JOIN_CODE_CHARS.length]).join("");
  return c.json({ code });
});

app.get("/sessions/:code/ws", async (c) => {
  const code = c.req.param("code").toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return c.json({ error: "Invalid code" }, 400);
  const stub = c.env.SPLIT_SESSION.get(c.env.SPLIT_SESSION.idFromName(code));
  const url = new URL(c.req.url);
  url.searchParams.set("userId", c.get("userId"));
  return stub.fetch(new Request(url, c.req.raw));
});

export default app satisfies ExportedHandler<Env>;
