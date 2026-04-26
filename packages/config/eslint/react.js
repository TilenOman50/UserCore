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
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
];
