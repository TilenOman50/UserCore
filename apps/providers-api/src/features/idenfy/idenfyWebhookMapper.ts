import { z } from "zod";

import type {
  AttributeType,
  WorkflowSessionStatus,
} from "@usercore/shared-types";

// iDenfy callback payload — fields per their public docs. Only fields we map
// into UserCore are validated; the rest pass through as raw payload.
export const IdenfyWebhookPayload = z.object({
  clientId: z.string(),
  scanRef: z.string(),
  status: z
    .object({
      overall: z
        .enum(["APPROVED", "DENIED", "REVIEWING", "EXPIRED", "ACTIVE"])
        .optional(),
      autoDocument: z.string().optional(),
      autoFace: z.string().optional(),
      manualDocument: z.string().optional(),
      manualFace: z.string().optional(),
      fraudTags: z.array(z.string()).optional(),
      mismatchTags: z.array(z.string()).optional(),
      suspicionReasons: z.array(z.string()).optional(),
    })
    .optional(),
  data: z
    .object({
      docFirstName: z.string().optional(),
      docLastName: z.string().optional(),
      docNumber: z.string().optional(),
      docPersonalCode: z.string().optional(),
      docExpiry: z.string().optional(),
      docDateOfIssue: z.string().optional(),
      docDob: z.string().optional(),
      docType: z.string().optional(),
      docSex: z.string().optional(),
      docNationality: z.string().optional(),
      docIssuingCountry: z.string().optional(),
      fullName: z.string().optional(),
      selectedCountry: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  fileUrls: z
    .object({
      FRONT: z.string().optional(),
      BACK: z.string().optional(),
      FACE: z.string().optional(),
      FACE_VIDEO: z.string().optional(),
    })
    .optional(),
});
export type IdenfyWebhook = z.infer<typeof IdenfyWebhookPayload>;

// Map iDenfy's overall outcome to UserCore's session status. REVIEWING is
// surfaced to dashboard officers via REQUIRES_REVIEW.
export const mapIdenfyOverallStatus = (
  overall: string | undefined,
): WorkflowSessionStatus => {
  switch (overall) {
    case "APPROVED":
      return "SUCCEEDED";
    case "DENIED":
    case "EXPIRED":
      return "FAILED";
    case "REVIEWING":
      return "REQUIRES_REVIEW";
    default:
      return "PENDING";
  }
};

// Translate a webhook payload into a flat list of EAV attribute upserts. The
// canonical keys (identity_verification.document_number etc.) are the same
// shape the manual-review path writes — providers and humans share one schema.
export const mapIdenfyToAttributes = (
  payload: IdenfyWebhook,
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
  const data = payload.data;
  if (data) {
    const stringFields: Array<[string, string | undefined]> = [
      ["identity_verification.document_first_name", data.docFirstName],
      ["identity_verification.document_last_name", data.docLastName],
      ["identity_verification.document_number", data.docNumber],
      ["identity_verification.document_personal_code", data.docPersonalCode],
      ["identity_verification.document_type", data.docType],
      ["identity_verification.document_sex", data.docSex],
      [
        "identity_verification.document_nationality",
        data.docNationality,
      ],
      [
        "identity_verification.document_issuing_country",
        data.docIssuingCountry,
      ],
      ["identity_verification.full_name", data.fullName],
      ["identity_verification.selected_country", data.selectedCountry],
      ["identity_verification.address", data.address],
    ];
    for (const [attribute, value] of stringFields) {
      if (value !== undefined && value !== "") {
        out.push({ attribute, value, attributeType: "STRING" });
      }
    }
    const dateFields: Array<[string, string | undefined]> = [
      ["identity_verification.document_expiry", data.docExpiry],
      [
        "identity_verification.document_date_of_issue",
        data.docDateOfIssue,
      ],
      ["identity_verification.date_of_birth", data.docDob],
    ];
    for (const [attribute, value] of dateFields) {
      if (value !== undefined && value !== "") {
        out.push({ attribute, value, attributeType: "DATE" });
      }
    }
  }
  if (payload.status?.overall) {
    out.push({
      attribute: "identity_verification.provider_decision",
      value: payload.status.overall,
      attributeType: "STRING",
    });
  }
  out.push({
    attribute: "identity_verification.provider_scan_ref",
    value: payload.scanRef,
    attributeType: "STRING",
  });
  return out;
};
