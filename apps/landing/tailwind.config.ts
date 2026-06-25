import type { Config } from "tailwindcss";

// Match the dashboard's palette exactly so the landing page reads as the
// same product, not "a marketing site by the same team." Dashboard exposes
// `primary` (not `brand`) and uses gray-* (not slate-*) for neutrals —
// mirroring both here keeps every screenshot/mock visually identical.
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        primary: {
          DEFAULT: "#C0E1D2",
          50: "#f0f9f5",
          100: "#d9f0e7",
          200: "#C0E1D2",
          300: "#93caB3",
          400: "#5fae8d",
          500: "#3d9270",
          600: "#2d7558",
          700: "#255f47",
          800: "#1f4d3a",
          900: "#1a3f30",
        },
      },
      boxShadow: {
        soft: "0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 24px rgba(15, 23, 42, 0.04)",
        lift: "0 1px 2px rgba(15, 23, 42, 0.06), 0 12px 40px rgba(15, 23, 42, 0.08)",
        deep: "0 30px 80px -20px rgba(15, 23, 42, 0.25), 0 8px 24px -8px rgba(15, 23, 42, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
