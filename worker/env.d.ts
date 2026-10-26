// Secrets are not in wrangler.jsonc, so `wrangler types` can't see them.
interface Env {
  ANTHROPIC_API_KEY: string;
}
