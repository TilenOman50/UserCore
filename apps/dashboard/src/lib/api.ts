import {
  USERCORE_WIDGET_URL,
  USERCORE_WORKFLOWS_API_PUBLIC_URL,
} from "@usercore/shared-types";

export const AUTH_API_URL = "http://localhost:3001";
export const TMS_API_URL = "http://localhost:3002";
export const IDENTITY_API_URL = "http://localhost:3003";
export const SCENARIOS_API_URL = "http://localhost:3005";
export const DASHBOARD_API_URL = "http://localhost:3006";

// Dashboard's own backend fetches stay on localhost — no need to round-trip
// through ngrok for the review queue, etc.
export const WORKFLOWS_API_URL = "http://localhost:3004";

// What the dashboard's "Test the flow" iframe loads. Public URL (ngrok in
// dev, usercore.app in prod) so the widget's `window.location.origin`
// resolves to something a phone can reach for the QR handoff.
export const WIDGET_IFRAME_URL = USERCORE_WIDGET_URL;
export const WIDGET_WORKFLOWS_API_URL = USERCORE_WORKFLOWS_API_PUBLIC_URL;

export const apiFetch = async <T>(
  url: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    const message = await response
      .json()
      .then(
        (body: { error?: string; message?: string }) =>
          body.error ?? body.message,
      )
      .catch(() => null);
    throw new Error(message ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
};
