import { DurableObject } from "cloudflare:workers";
import { isMatch, type Swipe } from "../shared/match";

// One instance per Split it session. Both phones hold a WebSocket to it; it
// stores every swipe in its own SQLite storage and announces matches.

type ClientMessage = { type: "swipe"; dishId: string; liked: boolean };

export type ServerMessage =
  | { type: "joined"; members: string[] }
  | { type: "match"; dishId: string }
  | { type: "progress"; userId: string; swiped: number }
  | { type: "error"; message: string };

export class SplitSession extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS members (user_id TEXT PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS swipes (
          user_id TEXT NOT NULL, dish_id TEXT NOT NULL, liked INTEGER NOT NULL,
          PRIMARY KEY (user_id, dish_id)
        );
        CREATE TABLE IF NOT EXISTS matches (dish_id TEXT PRIMARY KEY);
      `);
    });
  }

  private members(): string[] {
    return this.ctx.storage.sql.exec<{ user_id: string }>("SELECT user_id FROM members").toArray().map((r) => r.user_id);
  }

  private broadcast(message: ServerMessage) {
    const data = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) ws.send(data);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }
    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId) return new Response("Missing userId", { status: 400 });

    const members = this.members();
    if (!members.includes(userId)) {
      if (members.length >= 2) return new Response("This table is full", { status: 403 });
      this.ctx.storage.sql.exec("INSERT INTO members (user_id) VALUES (?)", userId);
    }

    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [userId]);
    this.broadcast({ type: "joined", members: this.members() });
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
    if (message.type !== "swipe" || typeof message.dishId !== "string") return;

    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO swipes (user_id, dish_id, liked) VALUES (?, ?, ?)",
      userId,
      message.dishId,
      message.liked ? 1 : 0,
    );

    const swiped = this.ctx.storage.sql
      .exec<{ n: number }>("SELECT COUNT(*) AS n FROM swipes WHERE user_id = ?", userId)
      .one().n;
    this.broadcast({ type: "progress", userId, swiped });

    if (!message.liked) return;
    const swipes: Swipe[] = this.ctx.storage.sql
      .exec<{ user_id: string; dish_id: string; liked: number }>(
        "SELECT user_id, dish_id, liked FROM swipes WHERE dish_id = ?",
        message.dishId,
      )
      .toArray()
      .map((r) => ({ userId: r.user_id, dishId: r.dish_id, liked: r.liked === 1 }));
    const alreadyMatched =
      this.ctx.storage.sql.exec("SELECT 1 FROM matches WHERE dish_id = ?", message.dishId).toArray().length > 0;

    if (!alreadyMatched && isMatch(swipes, message.dishId, this.members())) {
      this.ctx.storage.sql.exec("INSERT INTO matches (dish_id) VALUES (?)", message.dishId);
      this.broadcast({ type: "match", dishId: message.dishId });
    }
  }

  async webSocketClose(ws: WebSocket, code: number) {
    ws.close(code, "closing");
  }
}
