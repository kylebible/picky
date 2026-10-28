import { DurableObject } from "cloudflare:workers";
import type { Swipe } from "../shared/match";
import type { Menu } from "../shared/menu";
import type { OrderItem } from "../shared/order";
import {
  MAX_PEOPLE,
  tableMatches,
  type ClientMessage,
  type CreateTable,
  type Member,
  type ServerMessage,
  type TableInfo,
} from "../shared/split";

// One instance per table code. It holds the menu, the people, every swipe and
// everyone's order in its own SQLite storage, and tells every phone about matches.
// A table lasts TABLE_TTL_MS, then it wipes itself so the code can be reused.

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

export const TABLE_TTL_MS = 12 * 60 * 60 * 1000;

export class SplitSession extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => this.ensureSchema());
  }

  private ensureSchema() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS members (
        user_id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', allergies TEXT NOT NULL DEFAULT '[]',
        diet TEXT NOT NULL DEFAULT 'anything', host INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS swipes (
        user_id TEXT NOT NULL, dish_id TEXT NOT NULL, liked INTEGER NOT NULL,
        PRIMARY KEY (user_id, dish_id)
      );
      CREATE TABLE IF NOT EXISTS orders (user_id TEXT PRIMARY KEY, items TEXT NOT NULL DEFAULT '[]');
    `);
    // Columns added after the first tables were made; tables last 12 hours, so some may predate them.
    for (const column of [
      "nopes TEXT NOT NULL DEFAULT '[]'",
      "dislikes TEXT NOT NULL DEFAULT '[]'",
      "same_check INTEGER NOT NULL DEFAULT 0",
    ]) {
      try {
        this.ctx.storage.sql.exec(`ALTER TABLE members ADD COLUMN ${column}`);
      } catch {
        // Already there.
      }
    }
  }

  private meta(key: string): string | null {
    const rows = this.ctx.storage.sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = ?", key).toArray();
    return rows[0]?.value ?? null;
  }

  private members(): Member[] {
    return this.ctx.storage.sql
      .exec<{
        user_id: string;
        name: string;
        allergies: string;
        diet: string;
        nopes: string;
        dislikes: string;
        host: number;
        same_check: number;
      }>("SELECT * FROM members ORDER BY host DESC, rowid")
      .toArray()
      .map((r) => ({
        id: r.user_id,
        name: r.name,
        allergies: JSON.parse(r.allergies),
        diet: r.diet as Member["diet"],
        nopes: JSON.parse(r.nopes),
        dislikes: JSON.parse(r.dislikes),
        host: r.host === 1,
        sameCheck: r.same_check === 1,
      }));
  }

  private menu(): Menu {
    return JSON.parse(this.meta("menu")!) as Menu;
  }

  private swipes(): Swipe[] {
    return this.ctx.storage.sql
      .exec<{ user_id: string; dish_id: string; liked: number }>("SELECT user_id, dish_id, liked FROM swipes")
      .toArray()
      .map((r) => ({ userId: r.user_id, dishId: r.dish_id, liked: r.liked === 1 }));
  }

  /** Worked out from the swipes each time, since who can have a dish changes as people join. */
  private matches(): string[] {
    return tableMatches(this.menu().dishes, this.members(), this.swipes());
  }

  private orders(): Record<string, OrderItem[]> {
    const rows = this.ctx.storage.sql
      .exec<{ user_id: string; items: string }>("SELECT user_id, items FROM orders")
      .toArray();
    return Object.fromEntries(rows.map((r) => [r.user_id, JSON.parse(r.items)]));
  }

  /** Sends each connected phone the whole table state, tagged with who it is. */
  private broadcastState() {
    const members = this.members();
    const swipes = this.swipes();
    const matches = this.matches();
    const orders = this.orders();
    for (const ws of this.ctx.getWebSockets()) {
      const [you] = this.ctx.getTags(ws);
      ws.send(JSON.stringify({ type: "state", you, members, swipes, matches, orders } satisfies ServerMessage));
    }
  }

  private broadcast(message: ServerMessage) {
    const data = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) ws.send(data);
  }

  /** Whether the code is free: never used, or its table has expired. */
  isFree(): boolean {
    const created = this.meta("created_at");
    return created === null || Date.now() - Number(created) > TABLE_TTL_MS;
  }

  /** Sets up a new table. Returns false if the code is taken. */
  async create(hostId: string, table: CreateTable): Promise<boolean> {
    if (!this.isFree()) return false;
    // Clear out an expired table that used this code before.
    await this.ctx.storage.deleteAll();
    this.ensureSchema();
    this.ctx.storage.sql.exec("INSERT INTO meta (key, value) VALUES ('created_at', ?)", String(Date.now()));
    this.ctx.storage.sql.exec("INSERT INTO meta (key, value) VALUES ('menu', ?)", JSON.stringify(table.menu));
    this.ctx.storage.sql.exec(
      "INSERT INTO members (user_id, name, allergies, diet, nopes, dislikes, host) VALUES (?, ?, ?, ?, ?, ?, 1)",
      hostId,
      table.name,
      JSON.stringify(table.allergies),
      table.diet,
      JSON.stringify(table.nopes),
      JSON.stringify(table.dislikes),
    );
    await this.ctx.storage.setAlarm(Date.now() + TABLE_TTL_MS);
    return true;
  }

  /** What the join screen shows, or null when there's no table under this code. */
  info(): TableInfo | null {
    if (this.isFree()) return null;
    const menu = this.menu();
    const members = this.members();
    return {
      hostName: members.find((m) => m.host)?.name ?? "",
      restaurant: menu.restaurant_name,
      menu,
      full: members.length >= MAX_PEOPLE,
    };
  }

  async alarm() {
    for (const ws of this.ctx.getWebSockets()) ws.close(1000, "This table has closed");
    await this.ctx.storage.deleteAll();
    this.ensureSchema();
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }
    if (this.isFree()) return new Response("No table with this code", { status: 404 });
    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId) return new Response("Missing userId", { status: 400 });

    const members = this.members();
    if (!members.some((m) => m.id === userId)) {
      if (members.length >= MAX_PEOPLE) return new Response("This table is full", { status: 403 });
      this.ctx.storage.sql.exec("INSERT INTO members (user_id) VALUES (?)", userId);
    }

    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [userId]);
    this.broadcastState();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const [userId] = this.ctx.getTags(ws);
    let message: ClientMessage;
    try {
      message = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid message" } satisfies ServerMessage));
      return;
    }

    if (message.type === "hello") {
      // The host's details come from create(); this fills in the tablemate's.
      this.ctx.storage.sql.exec(
        "UPDATE members SET name = ?, allergies = ?, diet = ?, nopes = ?, dislikes = ? WHERE user_id = ? AND host = 0",
        String(message.name).slice(0, 40),
        JSON.stringify(strings(message.allergies)),
        typeof message.diet === "string" ? message.diet : "anything",
        JSON.stringify(strings(message.nopes)),
        JSON.stringify(strings(message.dislikes).slice(0, 40)),
        userId,
      );
      this.broadcastState();
      return;
    }

    if (message.type === "order") {
      if (!Array.isArray(message.items)) return;
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO orders (user_id, items) VALUES (?, ?)",
        userId,
        JSON.stringify(message.items.slice(0, 100)),
      );
      this.broadcastState();
      return;
    }

    if (message.type === "check") {
      this.ctx.storage.sql.exec("UPDATE members SET same_check = ? WHERE user_id = ?", message.same ? 1 : 0, userId);
      this.broadcastState();
      return;
    }

    if (message.type !== "swipe" || typeof message.dishId !== "string") return;
    const before = this.matches();
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO swipes (user_id, dish_id, liked) VALUES (?, ?, ?)",
      userId,
      message.dishId,
      message.liked ? 1 : 0,
    );
    if (message.liked && !before.includes(message.dishId) && this.matches().includes(message.dishId)) {
      this.broadcast({ type: "match", dishId: message.dishId });
    }
    this.broadcastState();
  }

  async webSocketClose(ws: WebSocket, code: number) {
    ws.close(code, "closing");
  }
}
