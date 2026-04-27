import {
  atLimit,
  getPlanFeatures,
  type PlanFeatures,
  type WorkflowStepType,
} from "@usercore/shared-types";

import { useWorkspace } from "../workspaceContext";

// Centralised access to the current org's plan features + the small handful of
// gating helpers the dashboard cares about. Keeps gating logic out of pages.
export const usePlan = () => {
  const { organization } = useWorkspace();
  const features: PlanFeatures = getPlanFeatures(organization.plan);

  return {
    plan: organization.plan,
    features,
    isProviderAllowed: (stepType: WorkflowStepType): boolean => {
      if (stepType === "duplicate-detection" || stepType === "rules-engine") {
        return true;
      }
      return features.providers[stepType];
    },
    workspaceLimitReached: (currentCount: number): boolean =>
      atLimit(currentCount, features.maxWorkspacesPerOrganization),
    workflowLimitReached: (currentCount: number): boolean =>
      atLimit(currentCount, features.maxWorkflowsPerWorkspace),
    memberLimitReached: (currentCount: number): boolean =>
      atLimit(currentCount, features.maxMembersPerOrganization),
    scenarioLimitReached: (currentCount: number): boolean =>
      atLimit(currentCount, features.maxScenarios),
  };
};

// Standard upgrade hint shown on disabled buttons / locked controls.
export const UPGRADE_HINT = "Plan limit reached — contact sales to upgrade.";

// Owner / admin can configure workflows, scenarios, providers, branding.
// Members are read-only on configuration but can still review KYC sessions.
export const useCanManageConfig = (): boolean => {
  const { role } = useWorkspace();
  return role === "owner" || role === "admin";
};

export const READ_ONLY_HINT = "Only owners and admins can edit configuration.";
