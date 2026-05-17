import type { Logger } from "@usercore/logger";
import type { ProviderShortName } from "@usercore/shared-types";

import { env } from "../../env";

// Result of asking workflows-api which credentials a given session should
// use for a given provider. `byo` carries the customer's own key (their
// account, their bill); `managed` means UserCore's env credentials apply.
export type EffectiveConfig =
  | { mode: "byo"; apiKey: string; apiSecret: string | null }
  | { mode: "managed" };

export const createEffectiveConfigClient = (props: { logger: Logger }) => {
  const { logger } = props;

  const get = async (data: {
    workflowSessionId: string;
    provider: ProviderShortName;
  }): Promise<EffectiveConfig> => {
    const params = new URLSearchParams({
      workflowSessionId: data.workflowSessionId,
      provider: data.provider,
    });
    const url = `${env.WORKFLOWS_API_URL}/workflows/provider-configurations/effective?${params.toString()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        logger.warn({
          msg: "Effective-config lookup non-OK — falling back to managed",
          status: res.status,
          provider: data.provider,
        });
        return { mode: "managed" };
      }
      return (await res.json()) as EffectiveConfig;
    } catch (err) {
      // Network blip → safest fallback is managed mode (UserCore's keys)
      // rather than failing the whole check. Logged so it's not silent.
      logger.warn({
        msg: "Effective-config lookup failed — falling back to managed",
        error: err instanceof Error ? err.message : String(err),
        provider: data.provider,
      });
      return { mode: "managed" };
    }
  };

  return { get };
};

export type EffectiveConfigClient = ReturnType<
  typeof createEffectiveConfigClient
>;
