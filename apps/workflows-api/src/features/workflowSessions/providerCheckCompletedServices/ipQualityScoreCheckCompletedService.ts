import type { Logger } from "@usercore/logger";
import type {
  AttributeType,
  ProviderCheckCompletedPayload,
} from "@usercore/shared-types";
import { iso2ToIso3 } from "@usercore/shared-types";

import type { WorkflowSessionsService } from "../workflowSessionsService";

const flattenIpQualityScorePayload = (
  rawPayload: Record<string, unknown>,
): Array<{
  attribute: string;
  value: string;
  attributeType: AttributeType;
}> => {
  const out: Array<{
    attribute: string;
    value: string;
    attributeType: AttributeType;
  }> = [];
  if (typeof rawPayload.fraud_score === "number") {
    out.push({
      attribute: "fraud_detection.fraud_score",
      value: String(rawPayload.fraud_score),
      attributeType: "NUMBER",
    });
  }
  if (typeof rawPayload.country_code === "string") {
    // IPQS returns ISO 3166-1 alpha-2 (\"US\"); the rule catalog uses alpha-3
    // (\"USA\") so they line up with the iDenfy/manual-review path.
    const iso3 = iso2ToIso3(rawPayload.country_code);
    if (iso3) {
      out.push({
        attribute: "fraud_detection.country_code",
        value: iso3,
        attributeType: "STRING",
      });
    }
  }
  for (const flag of [
    "vpn",
    "tor",
    "proxy",
    "is_crawler",
    "recent_abuse",
    "bot_status",
  ] as const) {
    const value = rawPayload[flag];
    if (typeof value === "boolean") {
      out.push({
        attribute: `fraud_detection.${flag}`,
        value: String(value),
        attributeType: "BOOLEAN",
      });
    }
  }
  // String enrichment fields. Note IPQS returns ISP upper-cased in the payload.
  const stringFields: Array<[string, string]> = [
    ["connection_type", "fraud_detection.connection_type"],
    ["ISP", "fraud_detection.isp"],
    ["region", "fraud_detection.region"],
    ["city", "fraud_detection.city"],
  ];
  for (const [field, attribute] of stringFields) {
    const value = rawPayload[field];
    if (typeof value === "string" && value.trim() !== "") {
      out.push({ attribute, value, attributeType: "STRING" });
    }
  }
  return out;
};

export const createIpQualityScoreCheckCompletedService = (props: {
  workflowSessionsService: WorkflowSessionsService;
  logger: Logger;
}) => {
  const { workflowSessionsService, logger } = props;

  const handleCompleted = async (payload: ProviderCheckCompletedPayload) => {
    const attributes = flattenIpQualityScorePayload(payload.rawPayload);
    await workflowSessionsService.writeAttributes({
      workflowSessionId: payload.workflowSessionId,
      attributes,
    });
    await workflowSessionsService.recordStepStatus({
      sessionId: payload.workflowSessionId,
      step: "fraud-detection",
      status: payload.status,
      message: payload.message ?? null,
    });
    logger.info({
      msg: "IPQS check completed processed",
      sessionId: payload.workflowSessionId,
      status: payload.status,
      attributesWritten: attributes.length,
    });
  };

  return { handleCompleted };
};

export type IpQualityScoreCheckCompletedService = ReturnType<
  typeof createIpQualityScoreCheckCompletedService
>;
