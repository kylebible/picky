import { defineConfig } from "vitest/config";

// Unit tests cover pure logic, so they run in Node without the Cloudflare plugin.
export default defineConfig({
  test: { include: ["shared/**/*.test.ts", "worker/**/*.test.ts"] },
});
