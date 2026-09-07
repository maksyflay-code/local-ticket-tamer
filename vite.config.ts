// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
      __BUILD_ID__: JSON.stringify(process.env.CF_VERSION_METADATA_ID ?? process.env.COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev"),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  },
});
