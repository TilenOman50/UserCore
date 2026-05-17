import type { Logger } from "@usercore/logger";

import type { env as Env } from "../../env";

// Real ComplyAdvantage AML search request shape.
//
// POST {COMPLY_ADVANTAGE_BASE_URL}/searches?api_key={key}
// Body: { search_term, client_ref, fuzziness, filters: { types, birth_year } }
// Returns: { content: { data: { id, ref, match_status, risk_level, total_hits, hits } } }
export type ComplyAdvantageSearchInput = {
  searchTerm: string;
  clientRef: string;
  fuzziness?: number;
  birthYear?: number;
  types?: Array<
    "sanction" | "warning" | "fitness-probity" | "pep" | "adverse-media"
  >;
};

export type ComplyAdvantageSearchOutput = {
  id: number;
  ref: string;
  matchStatus:
    | "no_match"
    | "potential_match"
    | "false_positive"
    | "true_positive";
  riskLevel: "unknown" | "low" | "medium" | "high";
  totalHits: number;
  raw: Record<string, unknown>;
};

export const createComplyAdvantageClient = (props: {
  env: Pick<
    typeof Env,
    "COMPLY_ADVANTAGE_API_KEY" | "COMPLY_ADVANTAGE_BASE_URL"
  >;
  logger: Logger;
}) => {
  const { env, logger } = props;

  const search = async (
    input: ComplyAdvantageSearchInput,
    // Per-call override — populated when the originating org has BYO
    // credentials configured + enabled. Null routes through env keys.
    apiKeyOverride?: string | null,
  ): Promise<ComplyAdvantageSearchOutput> => {
    const apiKey = apiKeyOverride ?? env.COMPLY_ADVANTAGE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ComplyAdvantage API key missing (COMPLY_ADVANTAGE_API_KEY)",
      );
    }
    const url = `${env.COMPLY_ADVANTAGE_BASE_URL}/searches?api_key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        search_term: input.searchTerm,
        client_ref: input.clientRef,
        fuzziness: input.fuzziness ?? 0.6,
        filters: {
          types: input.types ?? ["sanction", "pep", "adverse-media"],
          birth_year: input.birthYear,
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.error({
        msg: "ComplyAdvantage search failed",
        status: res.status,
        body,
      });
      throw new Error(`ComplyAdvantage search failed (${res.status})`);
    }
    const json = (await res.json()) as {
      content: {
        data: {
          id: number;
          ref: string;
          match_status: ComplyAdvantageSearchOutput["matchStatus"];
          risk_level: ComplyAdvantageSearchOutput["riskLevel"];
          total_hits: number;
        };
      };
    };
    return {
      id: json.content.data.id,
      ref: json.content.data.ref,
      matchStatus: json.content.data.match_status,
      riskLevel: json.content.data.risk_level,
      totalHits: json.content.data.total_hits,
      raw: json as unknown as Record<string, unknown>,
    };
  };

  return { search };
};

export type ComplyAdvantageClient = ReturnType<
  typeof createComplyAdvantageClient
>;
