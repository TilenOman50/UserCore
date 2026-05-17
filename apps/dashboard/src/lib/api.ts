export const AUTH_API_URL = "http://localhost:3001";
export const TMS_API_URL = "http://localhost:3002";
export const IDENTITY_API_URL = "http://localhost:3003";
export const WORKFLOWS_API_URL = "http://localhost:3004";
export const SCENARIOS_API_URL = "http://localhost:3005";
export const WIDGET_URL = "http://localhost:3007";

// URLs used by the "Test the flow on mobile" QR code. A phone can't reach
// `localhost`, so we either honour explicit ngrok / public overrides via env,
// or derive a LAN URL from the hostname the dashboard is currently being
// viewed on. If the dashboard is open at http://192.168.1.50:3000 then the
// phone can hit http://192.168.1.50:3007 (widget) and :3004 (workflows-api).
const ENV = import.meta.env as Record<string, string | undefined>;

export const getMobileUrls = (): {
  widgetUrl: string;
  workflowsApiUrl: string;
  isLocalhost: boolean;
} => {
  const widgetOverride = ENV.VITE_PUBLIC_WIDGET_URL;
  const workflowsOverride = ENV.VITE_PUBLIC_WORKFLOWS_API_URL;
  if (widgetOverride && workflowsOverride) {
    return {
      widgetUrl: widgetOverride,
      workflowsApiUrl: workflowsOverride,
      isLocalhost: false,
    };
  }
  const host = window.location.hostname;
  const isLocalhost = host === "localhost" || host === "127.0.0.1";
  return {
    widgetUrl: widgetOverride ?? `http://${host}:3007`,
    workflowsApiUrl: workflowsOverride ?? `http://${host}:3004`,
    isLocalhost,
  };
};

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
