import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  ScenarioActionConfig,
  ScenarioEvaluation,
} from "@usercore/shared-types";

import { apiFetch, SCENARIOS_API_URL, WORKFLOWS_API_URL } from "../api";

export type Scenario = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  evaluation: ScenarioEvaluation;
  actions: ScenarioActionConfig[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScenarioWorkflowLink = {
  workflowId: string;
  workflowStepId: string;
  workflowName: string;
};

export type ScenarioLinkMap = Record<string, ScenarioWorkflowLink[]>;

export const useScenarioLinks = (workspaceId: string) =>
  useQuery({
    queryKey: ["scenario-links", workspaceId],
    queryFn: () =>
      apiFetch<ScenarioLinkMap>(
        `${WORKFLOWS_API_URL}/workflows/rules-engine/scenario-links/workspace/${encodeURIComponent(workspaceId)}`,
      ),
    enabled: !!workspaceId,
  });

export const useScenariosList = (workspaceId: string) =>
  useQuery({
    queryKey: ["scenarios", workspaceId],
    queryFn: () =>
      apiFetch<Scenario[]>(
        `${SCENARIOS_API_URL}/scenarios/workspace/${encodeURIComponent(workspaceId)}`,
      ),
    enabled: !!workspaceId,
  });

export const useScenario = (scenarioId: string | null) =>
  useQuery({
    queryKey: ["scenario", scenarioId],
    queryFn: () =>
      apiFetch<Scenario>(
        `${SCENARIOS_API_URL}/scenarios/${encodeURIComponent(scenarioId!)}`,
      ),
    enabled: !!scenarioId,
  });

export const useCreateScenario = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      workspaceId: string;
      name: string;
      description?: string;
    }) =>
      apiFetch<Scenario>(`${SCENARIOS_API_URL}/scenarios`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["scenarios", vars.workspaceId] });
    },
  });
};

export const useUpdateScenario = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      scenarioId: string;
      patch: Partial<{
        name: string;
        description: string | null;
        evaluation: ScenarioEvaluation;
        actions: ScenarioActionConfig[];
      }>;
    }) =>
      apiFetch<Scenario>(
        `${SCENARIOS_API_URL}/scenarios/${encodeURIComponent(data.scenarioId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(data.patch),
        },
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["scenario", vars.scenarioId] });
      qc.invalidateQueries({ queryKey: ["scenarios"] });
    },
  });
};

export const useDeleteScenario = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scenarioId: string) =>
      apiFetch(
        `${SCENARIOS_API_URL}/scenarios/${encodeURIComponent(scenarioId)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenarios"] });
    },
  });
};
