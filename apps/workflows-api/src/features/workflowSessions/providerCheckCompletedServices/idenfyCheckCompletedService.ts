import type { Logger } from "@usercore/logger";
import type {
  AttributeType,
  ProviderCheckCompletedPayload,
} from "@usercore/shared-types";

import type { WorkflowSessionsService } from "../workflowSessionsService";

type IdenfyData = {
  docFirstName?: string;
  docLastName?: string;
  docNumber?: string;
  docPersonalCode?: string;
  docExpiry?: string;
  docDateOfIssue?: string;
  docDob?: string;
  docType?: string;
  docSex?: string;
  docNationality?: string;
  docIssuingCountry?: string;
  fullName?: string;
  selectedCountry?: string;
  address?: string;
};

type IdenfyStatus = {
  overall?: string;
  suspicionReasons?: string[];
};

const flattenIdenfyPayload = (
  rawPayload: Record<string, unknown>,
): Array<{ attribute: string; value: string; attributeType: AttributeType }> => {
  const out: Array<{
    attribute: string;
    value: string;
    attributeType: AttributeType;
  }> = [];
  const data = rawPayload.data as IdenfyData | undefined;
  const status = rawPayload.status as IdenfyStatus | undefined;
  const scanRef = rawPayload.scanRef as string | undefined;

  if (data) {
    const stringFields: Array<[string, string | undefined]> = [
      ["identity_verification.document_first_name", data.docFirstName],
      ["identity_verification.document_last_name", data.docLastName],
      ["identity_verification.document_number", data.docNumber],
      ["identity_verification.document_personal_code", data.docPersonalCode],
      ["identity_verification.document_type", data.docType],
      ["identity_verification.document_sex", data.docSex],
      ["identity_verification.nationality", data.docNationality],
      [
        "identity_verification.document_issuing_country",
        data.docIssuingCountry,
      ],
      ["identity_verification.full_name", data.fullName],
      ["identity_verification.country_of_residence", data.selectedCountry],
      ["identity_verification.address", data.address],
    ];
    for (const [attribute, value] of stringFields) {
      if (value !== undefined && value !== "") {
        out.push({ attribute, value, attributeType: "STRING" });
      }
    }
    const dateFields: Array<[string, string | undefined]> = [
      ["identity_verification.document_expiry", data.docExpiry],
      ["identity_verification.document_date_of_issue", data.docDateOfIssue],
      ["identity_verification.date_of_birth", data.docDob],
    ];
    for (const [attribute, value] of dateFields) {
      if (value !== undefined && value !== "") {
        out.push({ attribute, value, attributeType: "DATE" });
      }
    }
  }
  if (status?.overall) {
    out.push({
      attribute: "identity_verification.provider_decision",
      value: status.overall,
      attributeType: "STRING",
    });
  }
  if (scanRef) {
    out.push({
      attribute: "identity_verification.provider_scan_ref",
      value: scanRef,
      attributeType: "STRING",
    });
  }
  return out;
};

export const createIdenfyCheckCompletedService = (props: {
  workflowSessionsService: WorkflowSessionsService;
  logger: Logger;
}) => {
  const { workflowSessionsService, logger } = props;

  const handleCompleted = async (payload: ProviderCheckCompletedPayload) => {
    const attributes = flattenIdenfyPayload(payload.rawPayload);
    await workflowSessionsService.writeAttributes({
      workflowSessionId: payload.workflowSessionId,
      attributes,
    });
    await workflowSessionsService.recordStepStatus({
      sessionId: payload.workflowSessionId,
      step: "identity-verification",
      status: payload.status,
      message: payload.message ?? null,
    });
    logger.info({
      msg: "iDenfy check completed processed",
      sessionId: payload.workflowSessionId,
      status: payload.status,
      attributesWritten: attributes.length,
    });
  };

  return { handleCompleted };
};

export type IdenfyCheckCompletedService = ReturnType<
  typeof createIdenfyCheckCompletedService
>;
