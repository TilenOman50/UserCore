const reactHooks = require("eslint-plugin-react-hooks");
// eslint-plugin-react-refresh is ESM with a default export
const reactRefresh = require("eslint-plugin-react-refresh").default;
const globals = require("globals");

const baseConfig = require("./base.js");

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  ...baseConfig,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // These v7 rules flag legitimate patterns (setState-from-fetched-data,
      // window.location.assign, etc.) so we leave them off.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-refresh/only-export-components": "off",
    },
  },
];
