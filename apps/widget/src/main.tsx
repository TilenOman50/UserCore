import React from "react";
import ReactDOM from "react-dom/client";

import { Widget } from "./Widget";

import "./index.css";

// When the widget is hosted behind an ngrok free tunnel, the first browser
// request triggers an HTML warning page. AJAX requests bypass it if we tag
// every fetch with the documented opt-out header — but ONLY for requests
// that actually go through ngrok. Tagging cross-origin CDN fetches (e.g.
// MediaPipe's WASM + model loads from jsdelivr / googleapis) turns them
// into preflighted requests that fail on stricter mobile browsers.
const NGROK_HOSTS = [".ngrok-free.app", ".ngrok.app", ".ngrok.io"];
const isNgrokOrSameOrigin = (rawUrl: string): boolean => {
  try {
    const u = new URL(rawUrl, window.location.href);
    if (u.origin === window.location.origin) return true;
    return NGROK_HOSTS.some((h) => u.hostname.endsWith(h));
  } catch {
    return false;
  }
};

const originalFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (!isNgrokOrSameOrigin(url)) {
    return originalFetch(input, init);
  }
  const headers = new Headers(init?.headers);
  headers.set("ngrok-skip-browser-warning", "true");
  return originalFetch(input, { ...init, headers });
};

const params = new URLSearchParams(window.location.search);
const sessionId = params.get("session");
const workflowsApiUrl = params.get("workflowsApi") ?? "http://localhost:3004";
const providersApiUrl = params.get("providersApi") ?? "http://localhost:3008";
const mobileUrl = params.get("mobileUrl");
const isHandoff = params.get("handoff") === "true";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="min-h-screen flex items-center justify-center p-4">
      {sessionId ? (
        <Widget
          workflowsApiUrl={workflowsApiUrl}
          providersApiUrl={providersApiUrl}
          sessionId={sessionId}
          mobileUrl={mobileUrl}
          isHandoff={isHandoff}
          onComplete={(status) => console.log("Widget complete:", status)}
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 max-w-lg w-full p-6">
          <p className="text-sm text-gray-600">
            Missing <code className="font-mono">?session</code> URL parameter.
            The widget is launched from the dashboard's "Test the flow" button
            or via the SDK with a pre-created session id.
          </p>
        </div>
      )}
    </div>
  </React.StrictMode>,
);
