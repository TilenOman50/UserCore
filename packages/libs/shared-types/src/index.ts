import { nanoid } from "nanoid";
import { z } from "zod";

import { COUNTRIES, ISO2_TO_ISO3 } from "./countries.js";

export {
  COUNTRIES,
  COUNTRY_NAME_BY_CODE,
  type IsoCountryCode,
  iso2ToIso3,
  ISO2_TO_ISO3,
} from "./countries.js";

// ID generation — mirrors the platform's generateId pattern
export const generateId = (prefix: string): string => {
  return `${prefix}_${nanoid()}`;
};

// UserCore-hosted URLs that the customer's app embeds. In production these
// would point at UserCore's public infrastructure (e.g.
// `https://widget.usercore.app` + `https://api.usercore.app`); a customer
// integrating UserCore would never need to override them — they'd just
// paste a workspace API key into their env and ship.
//
// For the demo we point them at the same ngrok tunnels we use for
// dashboard's "Test the flow". One place to update when the tunnel rotates.
//
// Note: dashboard + mock sites use these ONLY for the widget iframe URL +
// the workflowsApi param the widget receives. Internal server-to-server
// fetches (e.g. dashboard hitting workflows-api for its review queue) still
// go to localhost for speed; only the phone needs the public URLs.
export const USERCORE_WIDGET_URL = "https://7e4c-95-143-159-3.ngrok-free.app";
export const USERCORE_WORKFLOWS_API_PUBLIC_URL =
  "https://5b93-95-143-159-3.ngrok-free.app";

// Public marketing site (where the dashboard's login page links back to).
// In production this would be `https://usercore.app`; locally it's the
// landing dev server on :3009.
export const USERCORE_LANDING_URL = "http://localhost:3009";

// KYC status enum
export const KYC_STATUSES = [
  "not_started",
  "pending",
  "approved",
  "rejected",
  "flagged",
] as const;
export const KycStatusEnum = z.enum(KYC_STATUSES);
export type KycStatus = z.infer<typeof KycStatusEnum>;

// Customer-level risk classification — shared by scenario actions
// (set_customer_risk_level) and the customer profile. "Unassessed" is the
// absence of a value (null), not an enum member.
export const CUSTOMER_RISK_LEVELS = ["low", "medium", "high"] as const;
export const CustomerRiskLevelEnum = z.enum(CUSTOMER_RISK_LEVELS);
export type CustomerRiskLevel = z.infer<typeof CustomerRiskLevelEnum>;

// Pagination schema
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;

// RabbitMQ event payload types
export const EVENTS = {
  WORKSPACE_CREATED: "workspace.created",
  WORKSPACE_DELETED: "workspace.deleted",
  KYC_COMPLETED: "kyc.completed",
  KYC_NOTIFICATION: "kyc.notification",
  SCENARIO_TRIGGERED: "scenario.triggered",
} as const;

export const WorkspaceCreatedPayload = z.object({
  workspaceId: z.string(),
  organizationId: z.string(),
  name: z.string(),
  ownerId: z.string(),
});
export type WorkspaceCreatedPayload = z.infer<typeof WorkspaceCreatedPayload>;

export const WorkspaceDeletedPayload = z.object({
  workspaceId: z.string(),
  organizationId: z.string(),
});
export type WorkspaceDeletedPayload = z.infer<typeof WorkspaceDeletedPayload>;

export const KycCompletedPayload = z.object({
  workflowSessionId: z.string(),
  customerId: z.string(),
  workspaceId: z.string(),
  status: KycStatusEnum,
  riskLevel: CustomerRiskLevelEnum.optional(),
  // Identity snapshot from the session so identity-api can populate the
  // customer profile (a decided customer appears in the customers table).
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  country: z.string().optional(),
  reviewedAt: z.string().datetime(),
  reviewedBy: z.string(),
  reason: z.string().optional(),
});
export type KycCompletedPayload = z.infer<typeof KycCompletedPayload>;

export const KycNotificationPayload = z.object({
  customerId: z.string(),
  email: z.string().email(),
  status: KycStatusEnum,
  reason: z.string().optional(),
});
export type KycNotificationPayload = z.infer<typeof KycNotificationPayload>;

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios — predefined attribute catalog, operator filtering by type, and
// the recursive evaluation tree shape stored as jsonb on each scenario.
// ─────────────────────────────────────────────────────────────────────────────

export const RULE_OPERATORS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "nin",
  "contains",
] as const;
export const RuleOperatorEnum = z.enum(RULE_OPERATORS);
export type RuleOperator = z.infer<typeof RuleOperatorEnum>;

export const ATTRIBUTE_VALUE_TYPES = [
  "string",
  "number",
  "boolean",
  "date",
  "enum",
  // Multi-valued list (stored as a comma-separated string in the EAV).
  // Compared with set-intersection semantics via `in` / `nin`.
  "multi-enum",
] as const;
export type AttributeValueType = (typeof ATTRIBUTE_VALUE_TYPES)[number];

export const OPERATORS_BY_ATTRIBUTE_TYPE: Record<
  AttributeValueType,
  readonly RuleOperator[]
> = {
  string: ["eq", "neq", "in", "nin", "contains"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte"],
  boolean: ["eq", "neq"],
  date: ["eq", "neq", "gt", "gte", "lt", "lte"],
  enum: ["eq", "neq", "in", "nin"],
  "multi-enum": ["in", "nin"],
};

export type AttributeDefinition = {
  key: string;
  label: string;
  category: string;
  type: AttributeValueType;
  enumValues?: readonly string[];
  // Hint to the UI that the (string) values should be rendered as country
  // names rather than raw codes. Used by the rule editor and review pages.
  valueDisplay?: "country";
};

// Attributes scenarios can match against. Keys mirror the dot-namespaced EAV
// keys workflows-api writes to workflow_session_attributes — adding a new
// attribute on the workflow side just means appending an entry here.
//
// `identity_verification.age` is computed from `identity_verification.date_of_birth`
// at evaluation time; it isn't stored.
export const SCENARIO_ATTRIBUTES: readonly AttributeDefinition[] = [
  {
    key: "identity_verification.age",
    label: "Customer age",
    category: "Identity",
    type: "number",
  },
  {
    // Canonical document_* key — matches the manual review form + iDenfy (both
    // write identity_verification.document_nationality).
    key: "identity_verification.document_nationality",
    label: "Nationality",
    category: "Identity",
    type: "enum",
    enumValues: COUNTRIES.map((c) => c.code),
    valueDisplay: "country",
  },
  {
    key: "identity_verification.country_of_residence",
    label: "Country of residence",
    category: "Identity",
    type: "enum",
    enumValues: COUNTRIES.map((c) => c.code),
    valueDisplay: "country",
  },
  {
    key: "identity_verification.document_type",
    label: "Document type",
    category: "Identity",
    type: "enum",
    enumValues: ["PASSPORT", "ID_CARD", "DRIVER_LICENSE", "RESIDENCE_PERMIT"],
  },
  {
    key: "identity_verification.document_issuing_country",
    label: "Document issuing country",
    category: "Identity",
    type: "enum",
    enumValues: COUNTRIES.map((c) => c.code),
    valueDisplay: "country",
  },
  {
    key: "identity_verification.document_sex",
    label: "Sex on document",
    category: "Identity",
    type: "enum",
    // Matches the capture form's options (M/F/X) — without X a customer whose
    // document sex is X could never be matched by a sex rule.
    enumValues: ["M", "F", "X"],
  },
  {
    key: "aml_screening.match_status",
    label: "AML match status",
    category: "AML screening",
    type: "enum",
    enumValues: [
      "no_match",
      "potential_match",
      "false_positive",
      "true_positive",
    ],
  },
  {
    key: "aml_screening.risk_level",
    label: "AML risk level",
    category: "AML screening",
    type: "enum",
    enumValues: ["unknown", "low", "medium", "high"],
  },
  {
    key: "aml_screening.total_hits",
    label: "AML total hits",
    category: "AML screening",
    type: "number",
  },
  {
    key: "aml_screening.hit_categories",
    label: "AML results",
    category: "AML screening",
    type: "multi-enum",
    enumValues: ["sanction", "pep", "adverse-media", "warning"],
  },
  {
    key: "fraud_detection.fraud_score",
    label: "Fraud score",
    category: "Fraud detection",
    type: "number",
  },
  {
    key: "fraud_detection.country_code",
    label: "IP country",
    category: "Fraud detection",
    type: "enum",
    enumValues: COUNTRIES.map((c) => c.code),
    valueDisplay: "country",
  },
  {
    key: "fraud_detection.vpn",
    label: "VPN detected",
    category: "Fraud detection",
    type: "boolean",
  },
  {
    key: "fraud_detection.tor",
    label: "Tor detected",
    category: "Fraud detection",
    type: "boolean",
  },
  {
    key: "fraud_detection.proxy",
    label: "Proxy detected",
    category: "Fraud detection",
    type: "boolean",
  },
  {
    key: "fraud_detection.is_crawler",
    label: "Is crawler",
    category: "Fraud detection",
    type: "boolean",
  },
  {
    key: "fraud_detection.recent_abuse",
    label: "Recent abuse",
    category: "Fraud detection",
    type: "boolean",
  },
  {
    key: "fraud_detection.bot_status",
    label: "Bot detected",
    category: "Fraud detection",
    type: "boolean",
  },
];

export const findAttributeDefinition = (
  key: string,
): AttributeDefinition | undefined => {
  return SCENARIO_ATTRIBUTES.find((a) => a.key === key);
};

// Normalize a country code to canonical ISO alpha-3 (codes already alpha-3, or
// unrecognized, pass through). Lets rule evaluation compare country-valued
// conditions regardless of whether the value was captured as alpha-2 (manual
// form / widget — e.g. "AR") or alpha-3 (iDenfy / the scenario enum — "ARG").
export const normalizeCountryCode = (code: string): string => {
  const upper = code.trim().toUpperCase();
  return ISO2_TO_ISO3[upper] ?? upper;
};

// Recursive evaluation tree. Each node is either a flat list of conditions
// joined by an AND/OR operator, or contains nested groups joined the same way.
export const ScenarioConditionSchema = z.object({
  attribute: z.string(),
  operator: RuleOperatorEnum,
  value: z.string(),
});
export type ScenarioCondition = z.infer<typeof ScenarioConditionSchema>;

export const QUERY_LOGIC_OPERATORS = ["AND", "OR"] as const;
export const QueryLogicOperatorEnum = z.enum(QUERY_LOGIC_OPERATORS);
export type QueryLogicOperator = z.infer<typeof QueryLogicOperatorEnum>;

export type ScenarioEvaluation = {
  operator: QueryLogicOperator;
  queries: ScenarioCondition[];
  queryGroups: ScenarioEvaluation[];
};

export const ScenarioEvaluationSchema: z.ZodType<ScenarioEvaluation> = z.lazy(
  () =>
    z.object({
      operator: QueryLogicOperatorEnum,
      queries: z.array(ScenarioConditionSchema),
      queryGroups: z.array(ScenarioEvaluationSchema),
    }),
);

export const emptyEvaluation = (): ScenarioEvaluation => ({
  operator: "AND",
  queries: [],
  queryGroups: [],
});

// Action catalog — no alerts, no transaction-side actions.
export const SCENARIO_ACTION_TYPES = [
  "set_customer_status",
  "set_customer_risk_level",
  "assign_tag",
] as const;
export const ScenarioActionTypeEnum = z.enum(SCENARIO_ACTION_TYPES);
export type ScenarioActionType = z.infer<typeof ScenarioActionTypeEnum>;

export const CUSTOMER_STATUS_VALUES = [
  "approved",
  "rejected",
  "flagged",
  "pending_review",
] as const;
export const CustomerStatusEnum = z.enum(CUSTOMER_STATUS_VALUES);
export type CustomerStatus = z.infer<typeof CustomerStatusEnum>;

export const ScenarioActionConfigSchema = z.object({
  type: ScenarioActionTypeEnum,
  // value is type-specific (status enum, risk level, tag list, email template)
  // — validated by the consumer when dispatched.
  value: z.string(),
  enabled: z.boolean().default(true),
});
export type ScenarioActionConfig = z.infer<typeof ScenarioActionConfigSchema>;

export const ScenarioTriggeredPayload = z.object({
  scenarioId: z.string(),
  customerId: z.string(),
  workspaceId: z.string(),
  actionType: ScenarioActionTypeEnum,
  actionValue: z.string(),
});
export type ScenarioTriggeredPayload = z.infer<typeof ScenarioTriggeredPayload>;

// ─────────────────────────────────────────────────────────────────────────────
// Pricing plans — applied at the organization level. Plan changes are
// sales-led (no in-app upgrade flow); the column is mutated server-side after
// a contract is signed.
// ─────────────────────────────────────────────────────────────────────────────

export const PLANS = ["STARTER", "GROWTH", "ENTERPRISE"] as const;
export const PlanEnum = z.enum(PLANS);
export type Plan = z.infer<typeof PlanEnum>;

// Sentinel for "no limit" — keeps JSON serialisation simple and lets callers
// use plain integer comparisons via the helpers below.
export const UNLIMITED = -1;

export const isUnlimited = (n: number): boolean => n === UNLIMITED;
export const atLimit = (current: number, max: number): boolean =>
  max !== UNLIMITED && current >= max;
export const withinLimit = (current: number, max: number): boolean =>
  !atLimit(current, max);

export type PlanFeatures = {
  // Per-step-type provider availability. true means the dashboard surfaces
  // provider dropdowns; false means the manual-review path is the only option.
  providers: {
    "identity-verification": boolean;
    "aml-screening": boolean;
    "fraud-detection": boolean;
  };
  // Quotas. UNLIMITED (-1) means no cap.
  maxWorkflowsPerWorkspace: number;
  maxWorkspacesPerOrganization: number;
  maxMembersPerOrganization: number;
  maxVerificationsPerMonth: number;
  maxScenarios: number;
  // Widget branding. customBranding: customer can upload logo + change colors.
  // whiteLabel: customer can hide the "Powered by UserCore" footer entirely.
  customBranding: boolean;
  whiteLabel: boolean;
};

const STARTER_FEATURES: PlanFeatures = {
  providers: {
    "identity-verification": false,
    "aml-screening": false,
    "fraud-detection": false,
  },
  maxWorkflowsPerWorkspace: 1,
  maxWorkspacesPerOrganization: 1,
  maxMembersPerOrganization: 2,
  maxVerificationsPerMonth: 100,
  maxScenarios: 0,
  customBranding: false,
  whiteLabel: false,
};

const GROWTH_FEATURES: PlanFeatures = {
  providers: {
    "identity-verification": true,
    "aml-screening": true,
    "fraud-detection": true,
  },
  maxWorkflowsPerWorkspace: UNLIMITED,
  maxWorkspacesPerOrganization: 5,
  maxMembersPerOrganization: 10,
  maxVerificationsPerMonth: 1000,
  maxScenarios: UNLIMITED,
  customBranding: true,
  whiteLabel: false,
};

const ENTERPRISE_FEATURES: PlanFeatures = {
  providers: {
    "identity-verification": true,
    "aml-screening": true,
    "fraud-detection": true,
  },
  maxWorkflowsPerWorkspace: UNLIMITED,
  maxWorkspacesPerOrganization: UNLIMITED,
  maxMembersPerOrganization: UNLIMITED,
  maxVerificationsPerMonth: UNLIMITED,
  maxScenarios: UNLIMITED,
  customBranding: true,
  whiteLabel: true,
};

const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  STARTER: STARTER_FEATURES,
  GROWTH: GROWTH_FEATURES,
  ENTERPRISE: ENTERPRISE_FEATURES,
};

export const getPlanFeatures = (plan: Plan): PlanFeatures =>
  PLAN_FEATURES[plan];

export const PLAN_LABELS: Record<Plan, string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  ENTERPRISE: "Enterprise",
};

// Common API response helpers
export const createSuccessResponse = <T>(data: T) => ({ data });
export const createErrorResponse = (error: string) => ({ error });

// ─────────────────────────────────────────────────────────────────────────────
// Workflow domain
// ─────────────────────────────────────────────────────────────────────────────

// Workflow type — the shape of the verification flow. UserCore is user-KYC only.
export const WORKFLOW_TYPES = ["USER_KYC"] as const;
export const WorkflowTypeEnum = z.enum(WORKFLOW_TYPES);
export type WorkflowType = z.infer<typeof WorkflowTypeEnum>;

// Workflows can be tested in sandbox or run against real providers in production.
export const WORKFLOW_VERIFICATION_MODES = ["sandbox", "production"] as const;
export const WorkflowVerificationModeEnum = z.enum(WORKFLOW_VERIFICATION_MODES);
export type WorkflowVerificationMode = z.infer<
  typeof WorkflowVerificationModeEnum
>;

// Top-level steps in a workflow. Each maps to a feature folder + an optional
// provider integration in providers-api.
export const WORKFLOW_STEP_TYPES = [
  "identity-verification",
  "aml-screening",
  "fraud-detection",
  "duplicate-detection",
  "rules-engine",
] as const;
export const WorkflowStepTypeEnum = z.enum(WORKFLOW_STEP_TYPES);
export type WorkflowStepType = z.infer<typeof WorkflowStepTypeEnum>;

// Sub-steps under identity-verification. Each is independently toggleable.
export const IDENTITY_VERIFICATION_SUB_STEP_TYPES = [
  "id-scan",
  "face-scan",
  "email-verification",
  "contact-information",
  "proof-of-residence",
  "terms-acceptance",
] as const;
export const IdentityVerificationSubStepTypeEnum = z.enum(
  IDENTITY_VERIFICATION_SUB_STEP_TYPES,
);
export type IdentityVerificationSubStepType = z.infer<
  typeof IdentityVerificationSubStepTypeEnum
>;

// ─────────────────────────────────────────────────────────────────────────────
// Canonical identity-data schema — THE shared contract for extracted ID data.
// Both the iDenfy webhook mapper (provider path) and the KYC review manual
// data-entry form (human path) write these exact EAV attribute keys, so
// everything downstream (AML search term, duplicate detection, rules engine)
// reads one source-agnostic schema and never needs to know who filled it.
// ─────────────────────────────────────────────────────────────────────────────
export const IDENTITY_ATTRIBUTE_PREFIX = "identity_verification";

// Build a fully-qualified EAV key from a field suffix, e.g.
// identityAttributeKey("document_number") → "identity_verification.document_number".
export const identityAttributeKey = (suffix: string): string =>
  `${IDENTITY_ATTRIBUTE_PREFIX}.${suffix}`;

export type IdentityFieldType = "STRING" | "DATE";

export type IdentityFieldDef = {
  // Suffix after the prefix, e.g. "document_first_name".
  key: string;
  // Fully-qualified EAV attribute key.
  attribute: string;
  // Human label for the manual review form.
  label: string;
  type: IdentityFieldType;
  // Part of the minimal set required before downstream checks (AML etc.) can
  // run and the session is considered "identity data ready". Core = name +
  // DOB, which is what AML screening needs to be meaningful.
  core: boolean;
};

const identityField = (
  key: string,
  label: string,
  type: IdentityFieldType,
  core = false,
): IdentityFieldDef => ({
  key,
  attribute: identityAttributeKey(key),
  label,
  type,
  core,
});

// Ordered for rendering in the manual data-entry form. Provider-only keys
// (provider_decision, provider_scan_ref, full_name) are intentionally NOT
// here — full_name is derived from first+last, the rest are iDenfy metadata.
export const IDENTITY_VERIFICATION_FIELDS: IdentityFieldDef[] = [
  identityField("document_first_name", "First name", "STRING", true),
  identityField("document_last_name", "Last name", "STRING", true),
  identityField("date_of_birth", "Date of birth", "DATE", true),
  identityField("document_type", "Document type", "STRING", true),
  identityField("document_number", "Document number", "STRING", true),
  // Nationality, issuing country and personal code stay optional: driver
  // licenses often omit nationality, and many countries' documents have no
  // personal/national code — requiring them would block valid documents.
  identityField("document_nationality", "Nationality", "STRING"),
  identityField("document_issuing_country", "Issuing country", "STRING"),
  identityField("document_personal_code", "Personal / national code", "STRING"),
  identityField("document_sex", "Sex", "STRING", true),
  identityField("document_date_of_issue", "Date of issue", "DATE", true),
  identityField("document_expiry", "Expiry date", "DATE", true),
  // Address lives on Proof of Residence — passports/ID cards don't show one.
  identityField("address", "Address", "STRING"),
];

// The minimal fields that must be present for downstream checks to run. Used
// by the "identity data ready" gate and the manual form's Run-checks enable.
export const REQUIRED_IDENTITY_FIELD_KEYS: string[] =
  IDENTITY_VERIFICATION_FIELDS.filter((f) => f.core).map((f) => f.attribute);

// Provider/derived keys that live under the same namespace but are not part
// of the manual form. Kept here so all canonical keys are documented in one
// place.
export const IDENTITY_DERIVED_KEYS = {
  fullName: identityAttributeKey("full_name"),
  providerDecision: identityAttributeKey("provider_decision"),
  providerScanRef: identityAttributeKey("provider_scan_ref"),
} as const;

// Document types accepted by the ID-scan step. Mirrors the widget's
// hardcoded picker until per-substep config exposes a subset.
export const ID_DOCUMENT_TYPES = [
  "PASSPORT",
  "ID_CARD",
  "DRIVER_LICENSE",
] as const;
export const IdDocumentTypeEnum = z.enum(ID_DOCUMENT_TYPES);
export type IdDocumentType = z.infer<typeof IdDocumentTypeEnum>;

export const POR_DOCUMENT_TYPES = [
  "GAS_BILL",
  "INTERNET_BILL",
  "ELECTRICITY_BILL",
  "RENT_AGREEMENT",
  "BANK_STATEMENT",
] as const;
export const PorDocumentTypeEnum = z.enum(POR_DOCUMENT_TYPES);
export type PorDocumentType = z.infer<typeof PorDocumentTypeEnum>;

// Predefined reject / resubmission reasons. Codes mirror iDenfy's reason
// vocabulary (autoDocument / autoFace / fraudTags) so the MANUAL review path and
// the iDenfy path speak the same codes — enabling iDenfy stays seamless. iDenfy
// has no resubmit-vs-reject split, so we annotate each with our own `severity`.
export const KYC_REASON_AREAS = ["document", "face", "fraud", "other"] as const;
export const KycReasonAreaEnum = z.enum(KYC_REASON_AREAS);
export type KycReasonArea = z.infer<typeof KycReasonAreaEnum>;

export const KYC_REASON_SEVERITIES = ["resubmit", "reject"] as const;
export const KycReasonSeverityEnum = z.enum(KYC_REASON_SEVERITIES);
export type KycReasonSeverity = z.infer<typeof KycReasonSeverityEnum>;

export type KycReason = {
  code: string;
  label: string;
  area: KycReasonArea;
  severity: KycReasonSeverity;
};

// Curated subset officers pick from. The iDenfy path can store ANY iDenfy code
// (the ingest is tolerant); this list is just what's offered in the modals.
export const KYC_REASONS: KycReason[] = [
  // Document — fixable (resubmit)
  {
    code: "DOC_TOO_BLURRY",
    label: "Document photo too blurry",
    area: "document",
    severity: "resubmit",
  },
  {
    code: "DOC_GLARED",
    label: "Glare on the document",
    area: "document",
    severity: "resubmit",
  },
  {
    code: "DOC_NOT_FULLY_VISIBLE",
    label: "Document not fully visible / cut off",
    area: "document",
    severity: "resubmit",
  },
  {
    code: "DOC_SIDE_MISMATCH",
    label: "Wrong or missing side of the document",
    area: "document",
    severity: "resubmit",
  },
  {
    code: "DOC_TYPE_MISMATCH",
    label: "Wrong document type uploaded",
    area: "document",
    severity: "resubmit",
  },
  // Document — terminal (reject)
  {
    code: "DOC_EXPIRED",
    label: "Document expired",
    area: "document",
    severity: "reject",
  },
  {
    code: "DOC_NOT_SUPPORTED",
    label: "Document type not supported",
    area: "document",
    severity: "reject",
  },
  {
    code: "DOC_DAMAGED",
    label: "Document damaged",
    area: "document",
    severity: "reject",
  },
  {
    code: "DOC_FAKE",
    label: "Fake / forged document",
    area: "document",
    severity: "reject",
  },
  {
    code: "DOC_SPOOF_DETECTED",
    label: "Document spoof detected",
    area: "document",
    severity: "reject",
  },
  {
    code: "DOC_MOBILE_PHOTO",
    label: "Photo of a screen, not a real document",
    area: "document",
    severity: "reject",
  },
  // Face — fixable
  {
    code: "FACE_TOO_BLURRY",
    label: "Selfie too blurry",
    area: "face",
    severity: "resubmit",
  },
  {
    code: "FACE_GLARED",
    label: "Glare on the selfie",
    area: "face",
    severity: "resubmit",
  },
  {
    code: "NO_FACE_FOUND",
    label: "No face detected in the selfie",
    area: "face",
    severity: "resubmit",
  },
  // Face — terminal
  {
    code: "FACE_MISMATCH",
    label: "Face does not match the document",
    area: "face",
    severity: "reject",
  },
  {
    code: "FAKE_FACE",
    label: "Fake / spoofed selfie",
    area: "face",
    severity: "reject",
  },
  {
    code: "FACE_SUSPECTED",
    label: "Suspected face fraud",
    area: "face",
    severity: "reject",
  },
  // Fraud — terminal
  {
    code: "AML_SUSPECTION",
    label: "AML / sanctions concern",
    area: "fraud",
    severity: "reject",
  },
  {
    code: "UNDER_AGE",
    label: "Below the minimum age",
    area: "fraud",
    severity: "reject",
  },
  {
    code: "DUPLICATE_FACE",
    label: "Duplicate — face already registered",
    area: "fraud",
    severity: "reject",
  },
  {
    code: "DUPLICATE_PERSONAL_DATA",
    label: "Duplicate — personal data already registered",
    area: "fraud",
    severity: "reject",
  },
  // Catch-all — shown in both modals (area "other")
  {
    code: "OTHER",
    label: "Other (see note)",
    area: "other",
    severity: "reject",
  },
];

// Customer-facing reason labels, localized so resume emails + the widget match
// the language the customer used. Only resubmit-severity reasons (+ OTHER) ever
// reach a customer, so only those are translated; anything else falls back to
// the English label. (Custom officer notes are never translated.)
const KYC_REASON_TRANSLATIONS: Record<string, Record<string, string>> = {
  sl: {
    DOC_TOO_BLURRY: "Fotografija dokumenta je preveč zamegljena",
    DOC_GLARED: "Odsev na dokumentu",
    DOC_NOT_FULLY_VISIBLE: "Dokument ni v celoti viden / odrezan",
    DOC_SIDE_MISMATCH: "Napačna ali manjkajoča stran dokumenta",
    DOC_TYPE_MISMATCH: "Naložena napačna vrsta dokumenta",
    FACE_TOO_BLURRY: "Selfi je preveč zamegljen",
    FACE_GLARED: "Odsev na selfiju",
    NO_FACE_FOUND: "Na selfiju ni zaznanega obraza",
    OTHER: "Drugo (glej opombo)",
  },
  de: {
    DOC_TOO_BLURRY: "Dokumentfoto zu unscharf",
    DOC_GLARED: "Spiegelung auf dem Dokument",
    DOC_NOT_FULLY_VISIBLE:
      "Dokument nicht vollständig sichtbar / abgeschnitten",
    DOC_SIDE_MISMATCH: "Falsche oder fehlende Dokumentseite",
    DOC_TYPE_MISMATCH: "Falscher Dokumenttyp hochgeladen",
    FACE_TOO_BLURRY: "Selfie zu unscharf",
    FACE_GLARED: "Spiegelung auf dem Selfie",
    NO_FACE_FOUND: "Kein Gesicht im Selfie erkannt",
    OTHER: "Sonstiges (siehe Hinweis)",
  },
  fr: {
    DOC_TOO_BLURRY: "Photo du document trop floue",
    DOC_GLARED: "Reflet sur le document",
    DOC_NOT_FULLY_VISIBLE: "Document non entièrement visible / coupé",
    DOC_SIDE_MISMATCH: "Côté du document incorrect ou manquant",
    DOC_TYPE_MISMATCH: "Mauvais type de document téléchargé",
    FACE_TOO_BLURRY: "Selfie trop flou",
    FACE_GLARED: "Reflet sur le selfie",
    NO_FACE_FOUND: "Aucun visage détecté sur le selfie",
    OTHER: "Autre (voir la note)",
  },
  es: {
    DOC_TOO_BLURRY: "Foto del documento demasiado borrosa",
    DOC_GLARED: "Reflejo en el documento",
    DOC_NOT_FULLY_VISIBLE: "Documento no totalmente visible / cortado",
    DOC_SIDE_MISMATCH: "Cara del documento incorrecta o faltante",
    DOC_TYPE_MISMATCH: "Tipo de documento incorrecto subido",
    FACE_TOO_BLURRY: "Selfie demasiado borroso",
    FACE_GLARED: "Reflejo en el selfie",
    NO_FACE_FOUND: "No se detecta ningún rostro en el selfie",
    OTHER: "Otro (ver la nota)",
  },
};

// Resolve a reason code to a label, optionally in the customer's locale.
// Falls back to the English catalog label, then the raw code.
export const kycReasonLabel = (code: string, locale?: string): string => {
  const translated =
    locale && locale !== "en"
      ? KYC_REASON_TRANSLATIONS[locale]?.[code]
      : undefined;
  return translated ?? KYC_REASONS.find((r) => r.code === code)?.label ?? code;
};

// providerConfig schemas, one per substep type. Stored as JSONB on the
// substep row. Missing fields => "no restriction"; the widget applies sane
// defaults when reading.
export const ID_SCAN_COUNTRY_MODES = [
  "all",
  "allowed_only",
  "blocked",
] as const;
export const IdScanCountryModeEnum = z.enum(ID_SCAN_COUNTRY_MODES);
export type IdScanCountryMode = z.infer<typeof IdScanCountryModeEnum>;

export const IdScanConfigSchema = z.object({
  // "all": accept any country.
  // "allowed_only": accept only countries in `countries`.
  // "blocked": accept any country EXCEPT those in `countries`.
  // Missing => "all" (treat `countries: [...]` as legacy allowed_only).
  countryMode: IdScanCountryModeEnum.optional(),
  countries: z.array(z.string()).nullable().optional(),
  documentTypes: z.array(IdDocumentTypeEnum).optional(),
});
export type IdScanConfig = z.infer<typeof IdScanConfigSchema>;

export const ContactInfoConfigSchema = z.object({
  fields: z
    .object({
      phone: z.boolean(),
      email: z.boolean(),
    })
    .optional(),
});
export type ContactInfoConfig = z.infer<typeof ContactInfoConfigSchema>;

export const ProofOfResidenceConfigSchema = z.object({
  documentTypes: z.array(PorDocumentTypeEnum).optional(),
});
export type ProofOfResidenceConfig = z.infer<
  typeof ProofOfResidenceConfigSchema
>;

export const TermsAcceptanceConfigSchema = z.object({
  // null/missing/empty = widget renders its built-in default TOS text.
  termsText: z.string().nullable().optional(),
});
export type TermsAcceptanceConfig = z.infer<typeof TermsAcceptanceConfigSchema>;

// Per-workflow widget branding. Plan-gated on the dashboard side:
//   STARTER:     all fields locked → widget shows default UserCore branding.
//   GROWTH:      brandName, logoS3Key, primaryColor editable. PoweredBy stays.
//   ENTERPRISE:  also hidePoweredBy editable (white-label).
// Hex-colour validator shared between primary and secondary.
const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a #RRGGBB hex colour")
  .nullable()
  .optional();

export const WorkflowBrandingSchema = z.object({
  brandName: z.string().nullable().optional(),
  logoS3Key: z.string().nullable().optional(),
  // primaryColor   → main CTA buttons in the widget.
  // secondaryColor → light accent backgrounds (icon tiles, "Up next" pill,
  //                  success/info panels). Pick a paler hue than primary.
  primaryColor: HexColorSchema,
  secondaryColor: HexColorSchema,
  hidePoweredBy: z.boolean().optional(),
  // Custom From address for transactional emails (the OTP). Enterprise-only:
  // an elderly customer mid-onboarding distrusts a noreply@usercore email
  // arriving during what they think is a bank flow. Empty/null falls back
  // to env.SMTP_FROM.
  senderEmail: z.string().email().nullable().optional(),
});
export type WorkflowBranding = z.infer<typeof WorkflowBrandingSchema>;

// Providers that workflows-api dispatches to via providers-api. Stubs without
// API keys; real client code that 401s without env credentials.
export const PROVIDER_SHORT_NAMES = [
  "idenfy",
  "complyAdvantage",
  "ipQualityScore",
] as const;
export const ProviderShortNameEnum = z.enum(PROVIDER_SHORT_NAMES);
export type ProviderShortName = z.infer<typeof ProviderShortNameEnum>;

// Per-step decision: should the provider dispatch route through UserCore's
// managed env credentials, or through the org's bring-your-own credentials
// saved on the Providers page. "managed" is the default; "byo" only takes
// effect when credentials actually exist for that (org, provider) pair —
// otherwise the dispatcher falls back to managed.
export const PROVIDER_CREDENTIAL_MODES = ["managed", "byo"] as const;
export const ProviderCredentialModeEnum = z.enum(PROVIDER_CREDENTIAL_MODES);
export type ProviderCredentialMode = z.infer<typeof ProviderCredentialModeEnum>;

// Granular step identifier used in WorkflowSessionSteps — covers both top-level
// steps and identity-verification sub-steps so we can log status for each.
export const WORKFLOW_SESSION_STEP_TYPES = [
  ...WORKFLOW_STEP_TYPES,
  ...IDENTITY_VERIFICATION_SUB_STEP_TYPES,
] as const;
export const WorkflowSessionStepTypeEnum = z.enum(WORKFLOW_SESSION_STEP_TYPES);
export type WorkflowSessionStepType = z.infer<
  typeof WorkflowSessionStepTypeEnum
>;

// Status of a single step within a workflow session.
export const WORKFLOW_SESSION_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "SUCCEEDED",
  "FAILED",
  "REQUIRES_REVIEW",
] as const;
export const WorkflowSessionStatusEnum = z.enum(WORKFLOW_SESSION_STATUSES);
export type WorkflowSessionStatus = z.infer<typeof WorkflowSessionStatusEnum>;

// EAV value types for WorkflowSessionAttributes — values are stored as text and
// cast on read using attributeType.
export const ATTRIBUTE_TYPES = ["STRING", "BOOLEAN", "NUMBER", "DATE"] as const;
export const AttributeTypeEnum = z.enum(ATTRIBUTE_TYPES);
export type AttributeType = z.infer<typeof AttributeTypeEnum>;

// Where a workflow session originated.
export const EXTERNAL_SESSION_SOURCES = ["widget", "dashboard"] as const;
export const ExternalSessionSourceEnum = z.enum(EXTERNAL_SESSION_SOURCES);
export type ExternalSessionSource = z.infer<typeof ExternalSessionSourceEnum>;

// Reasons stored on a workflow's `reasons` jsonb when valid=false. Aggregated
// from per-step validity checks; surfaced in the dashboard editor.
export const WorkflowReasonSchema = z.object({
  stepType: WorkflowStepTypeEnum.optional(),
  message: z.string(),
});
export type WorkflowReason = z.infer<typeof WorkflowReasonSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Provider event payloads — RabbitMQ contract between workflows-api and
// providers-api. workflows-api publishes *.requested, providers-api publishes
// *.completed once the external check returns.
// ─────────────────────────────────────────────────────────────────────────────

export const PROVIDER_EVENTS = {
  CHECK_REQUESTED: "providers.check.requested",
  CHECK_COMPLETED: "providers.check.completed",
} as const;

export const ProviderCheckRequestedPayload = z.object({
  workflowSessionId: z.string(),
  workflowStepType: WorkflowStepTypeEnum,
  providerShortName: ProviderShortNameEnum,
  workspaceId: z.string(),
  customerId: z.string(),
  // sandbox → dispatcher short-circuits with a canned happy-path response
  // (no real API call, no usage charges). production → real provider HTTP.
  // Inherited from the originating workflow session.
  verificationMode: WorkflowVerificationModeEnum,
  // Step-specific input. The dispatcher in workflows-api fills this with
  // whatever the provider needs (e.g. customer name + DOB for AML screening).
  data: z.record(z.string(), z.unknown()),
  // Effective credentials resolved by workflows-api at publish time. When
  // the org has BYO enabled for this provider, their key (+ secret for
  // iDenfy) is embedded here so the dispatcher can route through their
  // account. Null/undefined means "use managed credentials" — the
  // dispatcher falls back to env keys. In production these would be
  // short-lived tokens rather than raw keys travelling through the queue.
  credentials: z
    .object({
      apiKey: z.string().nullable(),
      apiSecret: z.string().nullable(),
    })
    .nullable()
    .optional(),
});
export type ProviderCheckRequestedPayload = z.infer<
  typeof ProviderCheckRequestedPayload
>;

export const ProviderCheckCompletedPayload = z.object({
  workflowSessionId: z.string(),
  workflowStepType: WorkflowStepTypeEnum,
  providerShortName: ProviderShortNameEnum,
  status: WorkflowSessionStatusEnum,
  message: z.string().optional(),
  // Raw provider payload — the per-provider check-completed handler in
  // workflows-api flattens this into WorkflowSessionAttributes.
  rawPayload: z.record(z.string(), z.unknown()),
});
export type ProviderCheckCompletedPayload = z.infer<
  typeof ProviderCheckCompletedPayload
>;

// CORS — we accept any localhost variant, any RFC1918 LAN IP, and ngrok /
// cloudflared tunnel hostnames (HTTPS-only). This lets the dashboard run at
// the host's LAN IP for mobile QR testing, and tunnels for HTTPS-required
// flows (face-scan camera) without per-service config churn.
const DEV_CORS_PATTERNS: RegExp[] = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/(192\.168|10|172\.(1[6-9]|2[0-9]|3[01]))\.\d+\.\d+(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.ngrok(-free)?\.(io|app)$/,
  /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/,
];

export const resolveDevCorsOrigin = (
  origin: string,
): string | undefined | null => {
  if (!origin) return undefined;
  return DEV_CORS_PATTERNS.some((p) => p.test(origin)) ? origin : null;
};
