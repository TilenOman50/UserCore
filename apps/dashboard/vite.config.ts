import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3000,
    // Bind on 0.0.0.0 — when the dashboard is opened via the host's LAN IP,
    // sibling service hostnames default to that same IP so a phone scanning
    // the "Test the flow" QR can reach the widget + workflows-api.
    host: true,
  },
});
