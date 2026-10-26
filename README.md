# Picky

Snap the menu, see what you'll love, and swipe with your tablemate to find dishes to split.

Picky is a PWA on Cloudflare: one Worker serves the React app and a Hono API, menus are read by the Claude API, each "Split it" session runs in its own Durable Object, and data lives in D1. Everything is declared in `wrangler.jsonc`.

## Layout

| Path | What's there |
| --- | --- |
| `src/` | React PWA |
| `worker/` | Hono API (`index.ts`), menu reading (`menu.ts`), Split it Durable Object (`split-session.ts`) |
| `shared/` | Code used by both: the menu schema and match logic |
| `migrations/` | D1 schema as SQL migrations |
| `.github/workflows/ci.yml` | Checks every PR, uploads a preview per PR, deploys `main` |

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars   # add your Anthropic API key
npm run db:migrate:local
npm run dev
```

`npm test` runs unit tests, `npm run typecheck` checks types.

## Deploys

Merging to `main` deploys to production and applies D1 migrations. Each pull request gets a preview URL in its workflow summary. The first deploy creates the D1 database automatically.

One-time setup, as GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`: from the "Edit Cloudflare Workers" token template, plus Account > D1 > Edit
- `CLOUDFLARE_ACCOUNT_ID`
- `ANTHROPIC_API_KEY`
