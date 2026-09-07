// Configuração de build para instalação própria (VM / Docker), sem Cloudflare.
// Gera um servidor Node em .output/server/index.mjs
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
    __BUILD_ID__: JSON.stringify(process.env.COMMIT_SHA ?? "vm"),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  ssr: {
    noExternal: ["h3-v2"],
  },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({ customViteReactPlugin: true }),
    viteReact(),
  ],
});
