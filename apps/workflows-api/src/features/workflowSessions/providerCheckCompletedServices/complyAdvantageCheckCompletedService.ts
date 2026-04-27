import type { Logger } from "@usercore/logger";
import type {
  AttributeType,
  ProviderCheckCompletedPayload,
} from "@usercore/shared-types";

import type { WorkflowSessionsService } from "../workflowSessionsService";

const flattenComplyAdvantagePayload = (
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
  const data = (rawPayload as { content?: { data?: Record<string, unknown> } })
    .content?.data;
  if (!data) return out;
  if (typeof data.id === "number") {
    out.push({
      attribute: "aml_screening.search_id",
      value: String(data.id),
      attributeType: "NUMBER",
    });
  }
  if (typeof data.ref === "string") {
    out.push({
      attribute: "aml_screening.search_ref",
      value: data.ref,
      attributeType: "STRING",
    });
  }
  if (typeof data.match_status === "string") {
    out.push({
      attribute: "aml_screening.match_status",
      value: data.match_status,
      attributeType: "STRING",
    });
  }
  if (typeof data.risk_level === "string") {
    out.push({
      attribute: "aml_screening.risk_level",
      value: data.risk_level,
      attributeType: "STRING",
    });
  }
  if (typeof data.total_hits === "number") {
    out.push({
      attribute: "aml_screening.total_hits",
      value: String(data.total_hits),
      attributeType: "NUMBER",
    });
  }

  // Walk each hit's `doc.types[]` and bucket into our four categories;
  // store the result as a comma-separated multi-enum so rules can match
  // "AML results is one of [sanction, pep]".
  const categories = _hitCategoryList(data.hits);
  if (categories.length > 0) {
    out.push({
      attribute: "aml_screening.hit_categories",
      value: categories.join(","),
      attributeType: "STRING",
    });
  }

  return out;
};

const _hitCategoryList = (hits: unknown): string[] => {
  const set = new Set<string>();
  if (!Array.isArray(hits)) return [];
  for (const hit of hits) {
    const types = (hit as { doc?: { types?: unknown } }).doc?.types;
    if (!Array.isArray(types)) continue;
    for (const t of types) {
      if (typeof t !== "string") continue;
      if (t.startsWith("sanction")) set.add("sanction");
      else if (t.startsWith("pep")) set.add("pep");
      else if (t.startsWith("adverse-media")) set.add("adverse-media");
      else if (t === "warning") set.add("warning");
    }
  }
  return Array.from(set);
};

export const createComplyAdvantageCheckCompletedService = (props: {
  workflowSessionsService: WorkflowSessionsService;
  logger: Logger;
}) => {
  const { workflowSessionsService, logger } = props;

  const handleCompleted = async (payload: ProviderCheckCompletedPayload) => {
    const attributes = flattenComplyAdvantagePayload(payload.rawPayload);
    await workflowSessionsService.writeAttributes({
      workflowSessionId: payload.workflowSessionId,
      attributes,
    });
    await workflowSessionsService.recordStepStatus({
      sessionId: payload.workflowSessionId,
      step: "aml-screening",
      status: payload.status,
      message: payload.message ?? null,
    });
    logger.info({
      msg: "ComplyAdvantage check completed processed",
      sessionId: payload.workflowSessionId,
      status: payload.status,
      attributesWritten: attributes.length,
    });
  };

  return { handleCompleted };
};

export type ComplyAdvantageCheckCompletedService = ReturnType<
  typeof createComplyAdvantageCheckCompletedService
>;
