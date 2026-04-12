import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
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
    },
  },
  plugins: [],
};

export default config;
