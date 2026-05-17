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
      // Bind on 0.0.0.0 so the widget is reachable from a phone on the same
      // wifi when the dashboard's "Test the flow" modal shows a QR code.
      host: true,
      // Accept the tunnel hostnames so a single ngrok / cloudflared tunnel
      // can front the widget when testing on mobile.
      allowedHosts: [
        ".ngrok-free.app",
        ".ngrok.app",
        ".ngrok.io",
        ".trycloudflare.com",
      ],
      // Single-tunnel setup: proxy workflows-api calls through the same
      // origin as the widget. The phone hits ngrok → laptop's Vite → this
      // proxy → local workflows-api on :3004. Means you only need one tunnel.
      proxy: {
        "/workflows-api": {
          target: "http://localhost:3004",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/workflows-api/, ""),
        },
      },
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
