# Picky

PWA for reading restaurant menus, ranking dishes against a user's profile, and matching dishes between two tablemates. The product plan lives outside the repo; this file covers working in the code.

- Stack: React + Vite (`src/`), Hono on Cloudflare Workers (`worker/`), Durable Objects for live Split it sessions, D1 for data. All Cloudflare resources are declared in `wrangler.jsonc`; change infrastructure there, not in the dashboard.
- After editing `wrangler.jsonc`, run `npm run cf-typegen` to refresh `worker/worker-configuration.d.ts`.
- Schema changes are new files in `migrations/` (never edit an applied migration).
- Menu reading tries `MENU_MODEL` (Claude Haiku 5.5) first and retries on `MENU_RETRY_MODEL` (Claude Sonnet 5.5) when `needsRetry` flags the result. Menu photos are never stored.
- Allergen info is a warning, never a guarantee: anything inferred is marked `likely` and shown as a guess.
- Before pushing: `npm run typecheck && npm test && npx vite build`.
