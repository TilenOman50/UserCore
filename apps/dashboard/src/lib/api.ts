export const AUTH_API_URL = "http://localhost:3001";
export const TMS_API_URL = "http://localhost:3002";
export const IDENTITY_API_URL = "http://localhost:3003";
export const WORKFLOWS_API_URL = "http://localhost:3004";
export const SCENARIOS_API_URL = "http://localhost:3005";

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
