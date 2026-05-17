import { nanoid } from "nanoid";
import { z } from "zod";

import { COUNTRIES } from "./countries.js";

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
    key: "identity_verification.nationality",
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
    enumValues: ["M", "F"],
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
];

export const findAttributeDefinition = (
  key: string,
): AttributeDefinition | undefined => {
  return SCENARIO_ATTRIBUTES.find((a) => a.key === key);
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

export const CUSTOMER_RISK_LEVELS = ["low", "medium", "high"] as const;
export const CustomerRiskLevelEnum = z.enum(CUSTOMER_RISK_LEVELS);
export type CustomerRiskLevel = z.infer<typeof CustomerRiskLevelEnum>;

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

// Deployment status of a workflow definition.
export const WORKFLOW_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const WorkflowStatusEnum = z.enum(WORKFLOW_STATUSES);
export type WorkflowStatus = z.infer<typeof WorkflowStatusEnum>;

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
  // Step-specific input. The dispatcher in workflows-api fills this with
  // whatever the provider needs (e.g. customer name + DOB for AML screening).
  data: z.record(z.string(), z.unknown()),
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
