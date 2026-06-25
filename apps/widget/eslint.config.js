const base = require("@usercore/eslint-config/react");

module.exports = [
  ...base,
  // dist-sdk/ holds the bundled UMD SDK output (vite build --mode sdk) — that
  // was used when the demo sites loaded the widget as a script tag. It's
  // minified bundle code, not source, so eslint shouldn't lint it.
  { ignores: ["dist-sdk/**"] },
];
