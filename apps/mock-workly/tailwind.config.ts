import type { Config } from "tailwindcss";

// Workly palette — drawn directly from the brand logo: the "W" is a blue →
// violet gradient. Brand = the blue stroke, accent = the violet stroke.
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        // Left "W" stroke — vivid royal blue.
        brand: {
          50: "#eff5ff",
          100: "#dbe7fe",
          200: "#bed4fe",
          300: "#91b5fd",
          400: "#5d8efa",
          500: "#2f63f5",
          600: "#1f4ce3",
          700: "#1b3cc4",
          800: "#1a349a",
          900: "#162d7a",
          950: "#0b1740",
        },
        // Right "W" stroke — bright violet.
        accent: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
        },
      },
    },
  },
  plugins: [],
};

export default config;
