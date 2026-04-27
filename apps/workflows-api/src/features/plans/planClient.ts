import type { Logger } from "@usercore/logger";
import type { Plan } from "@usercore/shared-types";

export type OrganizationInfo = {
  id: string;
  name: string;
  plan: Plan;
  counts: { members: number; workspaces: number };
};

// Internal client for the auth-api plan lookup endpoint. Calls happen
// server-to-server inside the docker network; no auth header needed for the
// diploma scope.
export const createPlanClient = (props: {
  authApiUrl: string;
  logger: Logger;
}) => {
  const { authApiUrl, logger } = props;

  const getOrganization = async (
    organizationId: string,
  ): Promise<OrganizationInfo | null> => {
    const res = await fetch(
      `${authApiUrl}/auth/internal/organizations/${encodeURIComponent(organizationId)}`,
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      logger.error({
        msg: "Failed to fetch organization plan",
        organizationId,
        status: res.status,
      });
      throw new Error(`Failed to fetch organization plan (${res.status})`);
    }
    return (await res.json()) as OrganizationInfo;
  };

  return { getOrganization };
};

export type PlanClient = ReturnType<typeof createPlanClient>;
