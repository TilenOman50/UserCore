import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, WORKFLOWS_API_URL } from "../api";

export type WorkflowStepType =
  | "identity-verification"
  | "aml-screening"
  | "fraud-detection"
  | "duplicate-detection"
  | "rules-engine";

export type ProviderShortName = "idenfy" | "complyAdvantage" | "ipQualityScore";

export type IdentityVerificationSubStepType =
  | "id-scan"
  | "face-scan"
  | "email-verification"
  | "contact-information"
  | "proof-of-residence"
  | "terms-acceptance";

export type ProviderCredentialMode = "managed" | "byo";

export type WorkflowStep = {
  id: string;
  workflowId: string;
  type: WorkflowStepType;
  provider: ProviderShortName | null;
  providerCredentialMode: ProviderCredentialMode;
  valid: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowBranding = {
  brandName?: string | null;
  logoS3Key?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  hidePoweredBy?: boolean;
  senderEmail?: string | null;
};

export type Workflow = {
  id: string;
  type: "USER_KYC";
  workspaceId: string;
  organizationId: string;
  displayName: string;
  description: string | null;
  valid: boolean;
  reasons: Array<{ stepType?: WorkflowStepType; message: string }>;
  verificationMode: "sandbox" | "production";
  isDefault: boolean;
  branding: WorkflowBranding;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowWithSteps = Workflow & { steps: WorkflowStep[] };

export type IdentityVerificationSubStep = {
  id: string;
  type: IdentityVerificationSubStepType;
  enabled: boolean;
  valid: boolean;
  providerConfig: unknown;
  identityVerificationStepId: string;
  createdAt: string;
  updatedAt: string;
};

export type IdentityVerificationDetail = {
  step: {
    id: string;
    workflowStepId: string;
    createdAt: string;
    updatedAt: string;
  };
  subSteps: IdentityVerificationSubStep[];
};

export type RulesEngineScenarioLink = {
  id: string;
  rulesEngineStepId: string;
  externalScenarioId: string;
  createdAt: string;
  updatedAt: string;
};

export type RulesEngineDetail = {
  step: {
    id: string;
    workflowStepId: string;
    createdAt: string;
    updatedAt: string;
  };
  scenarios: RulesEngineScenarioLink[];
};

export const useWorkflowsList = (workspaceId: string, organizationId: string) =>
  useQuery({
    queryKey: ["workflows", workspaceId],
    queryFn: () =>
      apiFetch<Workflow[]>(
        `${WORKFLOWS_API_URL}/workflows/workflows/workspace/${encodeURIComponent(workspaceId)}?organizationId=${encodeURIComponent(organizationId)}`,
      ),
    enabled: !!workspaceId && !!organizationId,
  });

export type WorkflowsPage = {
  items: Workflow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const useWorkflowsPaginated = (data: {
  workspaceId: string;
  organizationId: string;
  page: number;
  limit: number;
}) =>
  useQuery({
    queryKey: [
      "workflows",
      data.workspaceId,
      "paginated",
      data.page,
      data.limit,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        organizationId: data.organizationId,
        page: String(data.page),
        limit: String(data.limit),
      });
      return apiFetch<WorkflowsPage>(
        `${WORKFLOWS_API_URL}/workflows/workflows/workspace/${encodeURIComponent(data.workspaceId)}?${params.toString()}`,
      );
    },
    enabled: !!data.workspaceId && !!data.organizationId,
  });

export const useWorkflow = (workflowId: string | null) =>
  useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: () =>
      apiFetch<WorkflowWithSteps>(
        `${WORKFLOWS_API_URL}/workflows/workflows/${encodeURIComponent(workflowId!)}`,
      ),
    enabled: !!workflowId,
  });

export const useCreateWorkflow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      workspaceId: string;
      organizationId: string;
      displayName: string;
    }) =>
      apiFetch<Workflow>(`${WORKFLOWS_API_URL}/workflows/workflows`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["workflows", vars.workspaceId] });
    },
  });
};

export const useUpdateWorkflow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      workflowId: string;
      patch: Partial<{
        displayName: string;
        description: string | null;
        verificationMode: "sandbox" | "production";
        isDefault: boolean;
        branding: WorkflowBranding;
      }>;
    }) =>
      apiFetch<Workflow>(
        `${WORKFLOWS_API_URL}/workflows/workflows/${encodeURIComponent(data.workflowId)}`,
        { method: "PATCH", body: JSON.stringify(data.patch) },
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["workflow", vars.workflowId] });
      qc.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
};

// Multipart upload bypasses apiFetch's JSON content-type header so the
// browser can set its own multipart boundary.
export const useUploadBrandingLogo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { workflowId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", data.file, data.file.name || "logo.png");
      const res = await fetch(
        `${WORKFLOWS_API_URL}/workflows/workflows/${encodeURIComponent(data.workflowId)}/branding/logo`,
        { method: "POST", body: formData, credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Logo upload failed (${res.status}) ${body}`);
      }
      return (await res.json()) as Workflow;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["workflow", vars.workflowId] });
      qc.invalidateQueries({
        queryKey: ["branding-logo-url", vars.workflowId],
      });
    },
  });
};

export const useBrandingLogoUrl = (workflowId: string | null) =>
  useQuery({
    queryKey: ["branding-logo-url", workflowId],
    queryFn: () =>
      apiFetch<{ url: string; key: string }>(
        `${WORKFLOWS_API_URL}/workflows/workflows/${encodeURIComponent(workflowId!)}/branding/logo/url`,
      ).catch(() => null),
    enabled: !!workflowId,
    retry: false,
  });

export const useDeleteWorkflow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workflowId: string) =>
      apiFetch(
        `${WORKFLOWS_API_URL}/workflows/workflows/${encodeURIComponent(workflowId)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
};

export const useIdentityVerificationDetail = (workflowStepId: string | null) =>
  useQuery({
    queryKey: ["identity-verification", workflowStepId],
    queryFn: () =>
      apiFetch<IdentityVerificationDetail>(
        `${WORKFLOWS_API_URL}/workflows/workflow-steps/${encodeURIComponent(workflowStepId!)}/identity-verification`,
      ),
    enabled: !!workflowStepId,
  });

export const useRulesEngineDetail = (workflowStepId: string | null) =>
  useQuery({
    queryKey: ["rules-engine", workflowStepId],
    queryFn: () =>
      apiFetch<RulesEngineDetail>(
        `${WORKFLOWS_API_URL}/workflows/workflow-steps/${encodeURIComponent(workflowStepId!)}/rules-engine`,
      ),
    enabled: !!workflowStepId,
  });

export const useLinkScenario = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { workflowStepId: string; scenarioId: string }) =>
      apiFetch<RulesEngineScenarioLink>(
        `${WORKFLOWS_API_URL}/workflows/workflow-steps/${encodeURIComponent(data.workflowStepId)}/rules-engine/scenarios`,
        {
          method: "POST",
          body: JSON.stringify({ externalScenarioId: data.scenarioId }),
        },
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ["rules-engine", vars.workflowStepId],
      });
      qc.invalidateQueries({ queryKey: ["scenario-links"] });
      qc.invalidateQueries({ queryKey: ["workflow"] });
    },
  });
};

export const useUnlinkScenario = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { workflowStepId: string; scenarioLinkId: string }) =>
      apiFetch(
        `${WORKFLOWS_API_URL}/workflows/workflow-steps/${encodeURIComponent(data.workflowStepId)}/rules-engine/scenarios/${encodeURIComponent(data.scenarioLinkId)}`,
        { method: "DELETE" },
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ["rules-engine", vars.workflowStepId],
      });
      qc.invalidateQueries({ queryKey: ["scenario-links"] });
      qc.invalidateQueries({ queryKey: ["workflow"] });
    },
  });
};

export const useToggleSubStep = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { subStepId: string; enabled: boolean }) =>
      apiFetch(
        `${WORKFLOWS_API_URL}/workflows/identity-verification/sub-steps/${encodeURIComponent(data.subStepId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ enabled: data.enabled }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["identity-verification"] });
      qc.invalidateQueries({ queryKey: ["workflow"] });
    },
  });
};

// Writes per-substep providerConfig JSON. Each substep type has its own
// shape (see shared-types: IdScanConfig, ContactInfoConfig, …). We keep the
// hook generic so all four editors share it.
export const useUpdateSubStepConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { subStepId: string; providerConfig: unknown }) =>
      apiFetch(
        `${WORKFLOWS_API_URL}/workflows/identity-verification/sub-steps/${encodeURIComponent(data.subStepId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ providerConfig: data.providerConfig }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["identity-verification"] });
    },
  });
};

export const useSetIdentityProvider = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      workflowStepId: string;
      provider: ProviderShortName | null;
      providerCredentialMode?: ProviderCredentialMode;
    }) =>
      apiFetch(
        `${WORKFLOWS_API_URL}/workflows/workflow-steps/${encodeURIComponent(data.workflowStepId)}/identity-verification/provider`,
        {
          method: "PATCH",
          body: JSON.stringify({
            provider: data.provider,
            providerCredentialMode: data.providerCredentialMode,
          }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow"] });
    },
  });
};

const stepEndpoints: Record<
  Exclude<WorkflowStepType, "identity-verification">,
  string
> = {
  "aml-screening": "aml-screening",
  "fraud-detection": "fraud-detection",
  "duplicate-detection": "duplicate-detection",
  "rules-engine": "rules-engine",
};

export const useAddWorkflowStep = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      workflowId: string;
      type: WorkflowStepType;
      provider?: ProviderShortName | null;
    }) => {
      const endpoint =
        data.type === "identity-verification"
          ? "identity-verification"
          : stepEndpoints[data.type];
      const requiresProvider =
        data.type === "aml-screening" || data.type === "fraud-detection";
      return apiFetch<WorkflowStep>(
        `${WORKFLOWS_API_URL}/workflows/workflows/${encodeURIComponent(data.workflowId)}/${endpoint}`,
        {
          method: "POST",
          body: JSON.stringify(
            requiresProvider || data.type === "identity-verification"
              ? { provider: data.provider ?? null }
              : {},
          ),
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow"] });
    },
  });
};

export const useRemoveWorkflowStep = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { workflowStepId: string; type: WorkflowStepType }) => {
      const endpoint =
        data.type === "identity-verification"
          ? "identity-verification"
          : stepEndpoints[data.type];
      return apiFetch(
        `${WORKFLOWS_API_URL}/workflows/workflow-steps/${encodeURIComponent(data.workflowStepId)}/${endpoint}`,
        { method: "DELETE" },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow"] });
    },
  });
};

export const useSetStepProvider = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      workflowStepId: string;
      type: "aml-screening" | "fraud-detection";
      provider: ProviderShortName | null;
      providerCredentialMode?: ProviderCredentialMode;
    }) =>
      apiFetch<WorkflowStep>(
        `${WORKFLOWS_API_URL}/workflows/workflow-steps/${encodeURIComponent(data.workflowStepId)}/${data.type}/provider`,
        {
          method: "PATCH",
          body: JSON.stringify({
            provider: data.provider,
            providerCredentialMode: data.providerCredentialMode,
          }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow"] });
    },
  });
};
