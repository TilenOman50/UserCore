import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiFetch, AUTH_API_URL } from "./api";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
};

export type CurrentOrganization = {
  id: string;
  name: string;
  slug: string;
};

export type CurrentWorkspace = {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
};

export type WorkspaceListItem = CurrentWorkspace & {
  isActive: boolean;
};

export type OrganizationListItem = CurrentOrganization & {
  role: string;
  isActive: boolean;
};

export type MeResponse = {
  user: CurrentUser;
  organization: CurrentOrganization;
  role: string;
  workspace: CurrentWorkspace | null;
  workspaces: WorkspaceListItem[];
  organizations: OrganizationListItem[];
};

const ACTIVE_WORKSPACE_STORAGE_KEY = "usercore:active-workspace-id";

export const getStoredWorkspaceId = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
};

export const setStoredWorkspaceId = (id: string | null) => {
  if (typeof window === "undefined") return;
  if (id) {
    window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, id);
  } else {
    window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  }
};

export const fetchMe = () => {
  const id = getStoredWorkspaceId();
  const url = id
    ? `${AUTH_API_URL}/auth/me?workspaceId=${encodeURIComponent(id)}`
    : `${AUTH_API_URL}/auth/me`;
  return apiFetch<MeResponse>(url);
};

const WorkspaceContext = createContext<MeResponse | null>(null);

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { data, isPending, error } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 60_000,
    retry: false,
  });

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Loading workspace...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-red-600">
          Failed to load workspace: {error?.message ?? "unknown error"}
        </div>
      </div>
    );
  }

  return (
    <WorkspaceContext.Provider value={data}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  }
  return ctx;
};
