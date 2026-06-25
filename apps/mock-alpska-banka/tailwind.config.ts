import type { Config } from "tailwindcss";

// Alpska Banka palette — drawn directly from the brand logo: cobalt-blue
// mountains as the primary, and the vibrant green wave as the accent.
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
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
      colors: {
        // Mountain blue.
        brand: {
          50: "#eff5ff",
          100: "#dbe7fe",
          200: "#bed4fe",
          300: "#91b5fd",
          400: "#5d8efa",
          500: "#3a6df5",
          600: "#2451ea",
          700: "#1b3fd0",
          800: "#1c37a9",
          900: "#1d3485",
          950: "#0f1e58",
        },
        // Wave green from the logo arc.
        accent: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
        },
      },
    },
  },
  plugins: [],
};

export default config;
