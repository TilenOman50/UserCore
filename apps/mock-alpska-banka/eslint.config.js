// The widget SDK bundle is shipped into public/ for the integration demo —
// it's third-party output, not source we lint.
module.exports = [
  { ignores: ["public/**"] },
  ...require("@usercore/eslint-config/react"),
];
