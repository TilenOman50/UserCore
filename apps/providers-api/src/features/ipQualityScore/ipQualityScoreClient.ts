import type { Logger } from "@usercore/logger";

import type { env as Env } from "../../env";

// Real IPQualityScore IP lookup.
//
// GET {IPQS_BASE_URL}/ip/{API_KEY}/{IP}
// Returns: { success, fraud_score, country_code, vpn, tor, proxy, is_crawler, ISP, ASN, host }
export type IpQualityScoreInput = {
  ip: string;
};

export type IpQualityScoreOutput = {
  success: boolean;
  fraudScore: number;
  countryCode: string | undefined;
  vpn: boolean;
  tor: boolean;
  proxy: boolean;
  isCrawler: boolean;
  raw: Record<string, unknown>;
};

export const createIpQualityScoreClient = (props: {
  env: Pick<typeof Env, "IPQS_API_KEY" | "IPQS_BASE_URL">;
  logger: Logger;
}) => {
  const { env, logger } = props;

  const checkIp = async (
    input: IpQualityScoreInput,
  ): Promise<IpQualityScoreOutput> => {
    if (!env.IPQS_API_KEY) {
      throw new Error("IPQS API key missing (IPQS_API_KEY)");
    }
    const url = `${env.IPQS_BASE_URL}/ip/${env.IPQS_API_KEY}/${encodeURIComponent(input.ip)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      logger.error({
        msg: "IPQS lookup failed",
        status: res.status,
        body,
      });
      throw new Error(`IPQS lookup failed (${res.status})`);
    }
    const json = (await res.json()) as {
      success: boolean;
      fraud_score: number;
      country_code?: string;
      vpn: boolean;
      tor: boolean;
      proxy: boolean;
      is_crawler: boolean;
    };
    return {
      success: json.success,
      fraudScore: json.fraud_score,
      countryCode: json.country_code,
      vpn: json.vpn,
      tor: json.tor,
      proxy: json.proxy,
      isCrawler: json.is_crawler,
      raw: json as unknown as Record<string, unknown>,
    };
  };

  return { checkIp };
};

export type IpQualityScoreClient = ReturnType<
  typeof createIpQualityScoreClient
>;
