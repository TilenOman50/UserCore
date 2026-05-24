import { z } from "zod";

import {
  IDENTITY_DERIVED_KEYS,
  identityAttributeKey,
  type AttributeType,
  type WorkflowSessionStatus,
} from "@usercore/shared-types";

// iDenfy callback payload — fields per their public docs. Only fields we map
// into UserCore are validated; the rest pass through as raw payload.
export const IdenfyWebhookPayload = z.object({
  clientId: z.string(),
  scanRef: z.string(),
  status: z
    .object({
      // Accept ANY overall status iDenfy sends (incl. SUSPECTED and any future
      // value) so a real verdict never fails validation and drops the webhook —
      // mapIdenfyOverallStatus decides how each one maps.
      overall: z.string().optional(),
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
    case "SUSPECTED":
    case "REVIEWING":
      // Something's off (face mismatch, duplicate, data mismatch, …) or iDenfy
      // wants a manual check — this is how an iDenfy customer lands in OUR
      // review queue for an officer to decide.
      return "REQUIRES_REVIEW";
    case "ACTIVE":
    case undefined:
      return "PENDING";
    default:
      // Unknown / new iDenfy status — route to a human rather than leave the
      // customer stuck looking "in progress".
      return "REQUIRES_REVIEW";
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
    // iDenfy payload field → canonical EAV key. Targets use
    // identityAttributeKey() so they stay in lockstep with the shared schema
    // (IDENTITY_VERIFICATION_FIELDS) the manual review form writes.
    const stringFields: Array<[string, string | undefined]> = [
      [identityAttributeKey("document_first_name"), data.docFirstName],
      [identityAttributeKey("document_last_name"), data.docLastName],
      [identityAttributeKey("document_number"), data.docNumber],
      [identityAttributeKey("document_personal_code"), data.docPersonalCode],
      [identityAttributeKey("document_type"), data.docType],
      [identityAttributeKey("document_sex"), data.docSex],
      [identityAttributeKey("document_nationality"), data.docNationality],
      [
        identityAttributeKey("document_issuing_country"),
        data.docIssuingCountry,
      ],
      [IDENTITY_DERIVED_KEYS.fullName, data.fullName],
      [identityAttributeKey("selected_country"), data.selectedCountry],
      [identityAttributeKey("address"), data.address],
    ];
    for (const [attribute, value] of stringFields) {
      if (value !== undefined && value !== "") {
        out.push({ attribute, value, attributeType: "STRING" });
      }
    }
    const dateFields: Array<[string, string | undefined]> = [
      [identityAttributeKey("document_expiry"), data.docExpiry],
      [identityAttributeKey("document_date_of_issue"), data.docDateOfIssue],
      [identityAttributeKey("date_of_birth"), data.docDob],
    ];
    for (const [attribute, value] of dateFields) {
      if (value !== undefined && value !== "") {
        out.push({ attribute, value, attributeType: "DATE" });
      }
    }
  }
  if (payload.status?.overall) {
    out.push({
      attribute: IDENTITY_DERIVED_KEYS.providerDecision,
      value: payload.status.overall,
      attributeType: "STRING",
    });
  }
  out.push({
    attribute: IDENTITY_DERIVED_KEYS.providerScanRef,
    value: payload.scanRef,
    attributeType: "STRING",
  });
  return out;
};
