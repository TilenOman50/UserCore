import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

// Two build modes:
//  - default `vite build` → static dev app (used as the standalone widget host)
//  - `vite build --mode sdk` → single UMD bundle exposing `window.UserCore`,
//    suitable for embedding in third-party sites.
export default defineConfig(({ mode }) => {
  const isSdk = mode === "sdk";
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    server: {
      port: 3007,
    },
    build: isSdk
      ? {
          lib: {
            entry: resolve(__dirname, "src/sdk.ts"),
            name: "UserCore",
            fileName: () => "usercore-widget.js",
            formats: ["umd"],
          },
          outDir: "dist-sdk",
          emptyOutDir: true,
          rollupOptions: {
            // Bundle React into the SDK so host pages don't need to load it.
            external: [],
          },
        }
      : undefined,
  };
});
