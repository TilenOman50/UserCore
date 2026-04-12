/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["./base.js", "plugin:react-hooks/recommended"],
  plugins: ["react-refresh"],
  rules: {
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
  },
  env: {
    browser: true,
  },
};
