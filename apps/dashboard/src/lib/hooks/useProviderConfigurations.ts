import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, WORKFLOWS_API_URL } from "../api";
import type { ProviderShortName } from "./useWorkflows";

export type ProviderConfiguration = {
  id: string;
  organizationId: string;
  provider: ProviderShortName;
  // Backend returns these masked (e.g. "••••abcd"); never the real secret.
  apiKey: string | null;
  apiSecret: string | null;
  enabled: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export const useProviderConfigurations = (organizationId: string | null) =>
  useQuery({
    queryKey: ["provider-configurations", organizationId],
    queryFn: () =>
      apiFetch<ProviderConfiguration[]>(
        `${WORKFLOWS_API_URL}/workflows/provider-configurations?organizationId=${encodeURIComponent(organizationId!)}`,
      ),
    enabled: !!organizationId,
  });

export const useUpsertProviderConfiguration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      organizationId: string;
      provider: ProviderShortName;
      apiKey: string | null;
      apiSecret: string | null;
      enabled: boolean;
    }) =>
      apiFetch<ProviderConfiguration>(
        `${WORKFLOWS_API_URL}/workflows/provider-configurations`,
        { method: "PUT", body: JSON.stringify(data) },
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ["provider-configurations", vars.organizationId],
      });
    },
  });
};

export const useDeleteProviderConfiguration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      organizationId: string;
      provider: ProviderShortName;
    }) =>
      apiFetch(
        `${WORKFLOWS_API_URL}/workflows/provider-configurations?organizationId=${encodeURIComponent(data.organizationId)}&provider=${encodeURIComponent(data.provider)}`,
        { method: "DELETE" },
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ["provider-configurations", vars.organizationId],
      });
    },
  });
};
