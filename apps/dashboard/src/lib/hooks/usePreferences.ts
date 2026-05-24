import { useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, DASHBOARD_API_URL } from "../api";
import { useWorkspace } from "../workspaceContext";

// Per-member dashboard preferences (table filters, etc.). Persisted server-side
// via dashboard-api for cross-device sync, and mirrored to localStorage so they
// apply instantly on load (no flicker waiting on the network). The server is the
// source of truth that reconciles on fetch; localStorage is the fast cache.
export type DashboardPreferences = {
  reviewQueue?: { status?: string; mode?: string; search?: string };
  // Future tables (customers, …) add their own keys to this blob.
  [key: string]: unknown;
};

const LS_PREFIX = "usercore:prefs:";
const SAVE_DEBOUNCE_MS = 600;
const STALE_MS = 5 * 60 * 1000;

const readLocal = (memberId: string): DashboardPreferences => {
  if (typeof window === "undefined" || !memberId) return {};
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + memberId);
    return raw ? (JSON.parse(raw) as DashboardPreferences) : {};
  } catch {
    return {};
  }
};

const writeLocal = (memberId: string, prefs: DashboardPreferences) => {
  if (typeof window === "undefined" || !memberId) return;
  try {
    window.localStorage.setItem(LS_PREFIX + memberId, JSON.stringify(prefs));
  } catch {
    /* ignore quota / private-mode write errors */
  }
};

const settingsUrl = (memberId: string) =>
  `${DASHBOARD_API_URL}/dashboard-api/members/${encodeURIComponent(
    memberId,
  )}/settings`;

export const usePreferences = () => {
  const { user, workspace } = useWorkspace();
  const memberId = user?.id ?? "";
  const workspaceId = workspace?.id ?? "";
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["dashboard-preferences", memberId],
    enabled: !!memberId,
    // localStorage gives an instant value on first render while the server
    // fetch reconciles in the background (placeholderData isn't cached, so the
    // fetch always runs).
    placeholderData: () => readLocal(memberId),
    staleTime: STALE_MS,
    queryFn: async () => {
      try {
        const data = await apiFetch<{
          preferences: DashboardPreferences | null;
        }>(settingsUrl(memberId));
        const prefs = data.preferences ?? {};
        writeLocal(memberId, prefs);
        return prefs;
      } catch {
        // 404 (no settings saved yet) or offline — fall back to the local cache.
        return readLocal(memberId);
      }
    },
  });

  const preferences: DashboardPreferences = query.data ?? {};

  // Debounced server write — coalesces rapid changes (e.g. typing a search)
  // into a single PUT. localStorage + the in-memory cache update immediately.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setPreference = useCallback(
    (key: string, value: unknown) => {
      if (!memberId) return;
      const cacheKey = ["dashboard-preferences", memberId];
      const current =
        qc.getQueryData<DashboardPreferences>(cacheKey) ?? readLocal(memberId);
      const next: DashboardPreferences = { ...current, [key]: value };
      qc.setQueryData(cacheKey, next);
      writeLocal(memberId, next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void apiFetch(settingsUrl(memberId), {
          method: "PUT",
          body: JSON.stringify({ workspaceId, preferences: next }),
        }).catch(() => undefined);
      }, SAVE_DEBOUNCE_MS);
    },
    [qc, memberId, workspaceId],
  );

  // `loaded` flips true once the server fetch has resolved (or fallen back to
  // the local cache). Consumers use it to hydrate local state from the server
  // even when localStorage was empty — e.g. after the member cleared their cache
  // or is on a different device.
  return { preferences, setPreference, loaded: query.isSuccess };
};
