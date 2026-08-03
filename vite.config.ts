// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { legacyCssPlugin } from "./vite-legacy-css";

function safeMcpPlugin() {
  try {
    const plugin = mcpPlugin();
    // No Windows, o mcpPlugin original pode falhar por causa da comparação C:/ vs C:\
    return {
      ...plugin,
      configResolved(...args: any[]) {
        try {
          return (plugin as any).configResolved?.(...args);
        } catch (e) {
          console.warn("[mcpPlugin] Ignorado no ambiente local Windows:", (e as Error).message);
        }
      },
    };
  } catch {
    return null;
  }
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    build: { target: "es2017" },
    esbuild: { target: "es2017" },
    optimizeDeps: { esbuildOptions: { target: "es2017" } },
    plugins: [
      safeMcpPlugin(),
      legacyCssPlugin(),
    ].filter(Boolean),
  },
});
