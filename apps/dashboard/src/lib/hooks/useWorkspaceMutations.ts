import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiFetch, AUTH_API_URL } from "../api";
import { setStoredWorkspaceId } from "../workspaceContext";

export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<{
        workspace: {
          id: string;
          name: string;
          slug: string;
          organizationId: string;
        };
      }>(`${AUTH_API_URL}/auth/workspaces/create`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: (data) => {
      // Make the new workspace active so the next /me returns it
      setStoredWorkspaceId(data.workspace.id);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
};

export const useSwitchWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      setStoredWorkspaceId(workspaceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
};

export const useRenameWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { workspaceId: string; name: string }) =>
      apiFetch<{
        workspace: { id: string; name: string; slug: string };
      }>(
        `${AUTH_API_URL}/auth/workspaces/${encodeURIComponent(data.workspaceId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: data.name }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) =>
      apiFetch<void>(
        `${AUTH_API_URL}/auth/workspaces/${encodeURIComponent(workspaceId)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      // Clear stored workspace id so /me falls back to the first remaining one
      setStoredWorkspaceId(null);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
};
