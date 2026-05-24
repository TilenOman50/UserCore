import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, WORKFLOWS_API_URL } from "../api";

export type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
};

// Returned only by create — the raw secret is shown once, then never again.
export type CreatedApiKey = ApiKey & { secret: string };

const BASE = `${WORKFLOWS_API_URL}/workflows/api-keys`;

export const useApiKeys = (workspaceId: string | null) =>
  useQuery({
    queryKey: ["api-keys", workspaceId],
    enabled: !!workspaceId,
    queryFn: () =>
      apiFetch<ApiKey[]>(
        `${BASE}?workspaceId=${encodeURIComponent(workspaceId!)}`,
      ),
  });

export const useCreateApiKey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      workspaceId: string;
      organizationId: string;
      name: string;
      createdBy?: string | null;
    }) =>
      apiFetch<CreatedApiKey>(BASE, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
};

export const useRevokeApiKey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; workspaceId: string }) =>
      apiFetch<void>(
        `${BASE}/${encodeURIComponent(data.id)}?workspaceId=${encodeURIComponent(
          data.workspaceId,
        )}`,
        { method: "DELETE" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
};
