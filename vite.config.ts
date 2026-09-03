// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Build target: a Cloudflare Worker (module syntax) by default — that is what
// `wrangler deploy` expects, and nitro writes the matching wrangler config plus
// static assets into .output. Vercel CI (VERCEL=1) still gets a Vercel bundle,
// and NITRO_PRESET always wins if another target is needed.
const preset =
  process.env["NITRO_PRESET"] ?? (process.env["VERCEL"] ? "vercel" : "cloudflare-module");

export default defineConfig({
  // Keep the browser-only media engines in their own chunks. Without this the
  // bundler merges unenv polyfills into the dash.js chunk, which makes the SSR
  // router import (and evaluate) dash.js on the server -> "window is not defined"
  // and every page returns the generic error screen in production.
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("node_modules/dashjs")) return "media-dashjs";
            if (id.includes("node_modules/hls.js")) return "media-hlsjs";
            if (id.includes("node_modules/artplayer")) return "media-artplayer";
            return undefined;
          },
        },
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: { preset },
});
