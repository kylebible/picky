import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  // Tags telemetry with the commit that built the app.
  define: { __APP_VERSION__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? "dev") },
});
