import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  json,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type {
  AttributeType,
  ExternalSessionSource,
  IdentityVerificationSubStepType,
  ProviderCredentialMode,
  WorkflowBranding,
  WorkflowReason,
  WorkflowSessionStatus,
  WorkflowSessionStepType,
} from "@usercore/shared-types";
import {
  ATTRIBUTE_TYPES,
  generateId,
  PROVIDER_SHORT_NAMES,
  WORKFLOW_STEP_TYPES,
  WORKFLOW_TYPES,
  WORKFLOW_VERIFICATION_MODES,
} from "@usercore/shared-types";

// ─────────────────────────────────────────────────────────────────────────────
// Workflow domain — workflow-driven KYC architecture. User KYC only, with
// optional provider integrations dispatched through providers-api.
// ─────────────────────────────────────────────────────────────────────────────

export const workflowTypeEnum = pgEnum("workflow_type", WORKFLOW_TYPES);
export const workflowVerificationModeEnum = pgEnum(
  "workflow_verification_mode",
  WORKFLOW_VERIFICATION_MODES,
);
export const workflowStepTypeEnum = pgEnum(
  "workflow_step_type",
  WORKFLOW_STEP_TYPES,
);
export const providerShortNameEnum = pgEnum(
  "provider_short_name",
  PROVIDER_SHORT_NAMES,
);
export const attributeTypeEnum = pgEnum("attribute_type", ATTRIBUTE_TYPES);

// Workflow definitions — one per workspace per type. Default-flagged workflow
// is the one the widget loads when no specific workflow is requested.
export const WorkflowTable = pgTable(
  "workflow",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId("workflow")),
    type: workflowTypeEnum("type").notNull().default("USER_KYC"),
    workspaceId: text("workspace_id").notNull(),
    organizationId: text("organization_id").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    valid: boolean("valid").notNull().default(false),
    reasons: jsonb("reasons").$type<WorkflowReason[]>().default([]).notNull(),
    verificationMode: workflowVerificationModeEnum("verification_mode")
      .notNull()
      .default("sandbox"),
    isDefault: boolean("is_default").notNull().default(false),
    // Widget branding overrides for this workflow. Plan-gated on the
    // dashboard side; widget reads logoS3Key, brandName, primaryColor, and
    // hidePoweredBy on boot to skin itself.
    branding: jsonb("branding").$type<WorkflowBranding>().default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    // Soft delete — when set, the workflow is hidden from list/detail views
    // but rows that reference it (workflow_session, audit data) still
    // resolve. Required for compliance record retention.
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    // Only one default workflow per (workspace, type) — partial unique index.
    uniqueDefault: uniqueIndex("workflow_unique_default_idx")
      .on(table.workspaceId, table.type, table.isDefault)
      .where(sql`${table.isDefault} = TRUE`),
    workspaceIdx: index("workflow_workspace_idx").on(
      table.workspaceId,
      table.organizationId,
    ),
    typeIdx: index("workflow_type_idx").on(table.type),
  }),
);

// Top-level steps within a workflow. Each row dispatches to a feature-specific
// config table (e.g. IdentityVerificationStepTable).
export const WorkflowStepTable = pgTable(
  "workflow_step",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId("workflowstep")),
    type: workflowStepTypeEnum("type").notNull(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => WorkflowTable.id, { onDelete: "cascade" }),
    valid: boolean("valid").notNull().default(false),
    // Null means "use UserCore's built-in path" (manual review for identity,
    // skipped for AML/fraud). Non-null routes to providers-api.
    provider: providerShortNameEnum("provider"),
    // "managed" → UserCore's env credentials handle the dispatch (default,
    // included in plan). "byo" → the org's saved credentials in
    // provider_configuration are used for this specific step. Irrelevant
    // when provider is null. Per-step so the same workflow can mix managed
    // AML with bring-your-own identity, etc.
    providerCredentialMode: text("provider_credential_mode")
      .$type<ProviderCredentialMode>()
      .notNull()
      .default("managed"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueWorkflowType: unique("workflow_step_unique_workflow_type").on(
      table.workflowId,
      table.type,
    ),
  }),
);

// identity-verification step config — placeholder join table; sub-steps
// reference this row.
export const IdentityVerificationStepTable = pgTable(
  "identity_verification_step",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId("identityverificationstep")),
    workflowStepId: text("workflow_step_id")
      .notNull()
      .unique()
      .references(() => WorkflowStepTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

// Sub-steps under identity-verification — id-scan, face-scan, etc. Each is
// independently toggleable via `enabled`. providerConfig is per-sub-step
// provider settings (kept jsonb for forward-compat with provider-specific
// tuning — currently used to store contact-information form field list).
export const IdentityVerificationSubStepTable = pgTable(
  "identity_verification_sub_step",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId("identityverificationsubstep")),
    type: text("type").$type<IdentityVerificationSubStepType>().notNull(),
    enabled: boolean("enabled").notNull().default(false),
    providerConfig: jsonb("provider_config"),
    valid: boolean("valid").notNull().default(false),
    identityVerificationStepId: text("identity_verification_step_id")
      .notNull()
      .references(() => IdentityVerificationStepTable.id, {
        onDelete: "cascade",
      }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueStepType: unique("identity_verification_sub_step_unique_type").on(
      table.identityVerificationStepId,
      table.type,
    ),
  }),
);

export const AmlScreeningStepTable = pgTable("aml_screening_step", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("amlscreeningstep")),
  workflowStepId: text("workflow_step_id")
    .notNull()
    .unique()
    .references(() => WorkflowStepTable.id, { onDelete: "cascade" }),
  screenOnCreated: boolean("screen_on_created").notNull().default(true),
  monitorOngoing: boolean("monitor_ongoing").notNull().default(false),
  providerConfig: jsonb("provider_config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const FraudDetectionStepTable = pgTable("fraud_detection_step", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("frauddetectionstep")),
  workflowStepId: text("workflow_step_id")
    .notNull()
    .unique()
    .references(() => WorkflowStepTable.id, { onDelete: "cascade" }),
  screenOnCreated: boolean("screen_on_created").notNull().default(true),
  providerConfig: jsonb("provider_config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const DuplicateDetectionStepTable = pgTable("duplicate_detection_step", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("duplicatedetectionstep")),
  workflowStepId: text("workflow_step_id")
    .notNull()
    .unique()
    .references(() => WorkflowStepTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const RulesEngineStepTable = pgTable("rules_engine_step", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("rulesenginestep")),
  workflowStepId: text("workflow_step_id")
    .notNull()
    .unique()
    .references(() => WorkflowStepTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Links a rules-engine step to a scenario defined in scenarios-api.
// externalScenarioId is opaque to workflows-api.
export const RulesEngineScenarioTable = pgTable(
  "rules_engine_scenario",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId("rulesenginescenario")),
    rulesEngineStepId: text("rules_engine_step_id")
      .notNull()
      .references(() => RulesEngineStepTable.id, { onDelete: "cascade" }),
    externalScenarioId: text("external_scenario_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    externalScenarioIdx: index("rules_engine_scenario_external_idx").on(
      table.externalScenarioId,
    ),
  }),
);

// Branding configuration for the widget rendered to customers. One per
// workflow.
export const IdentityWidgetTable = pgTable("identity_widget", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("identitywidget")),
  workflowId: text("workflow_id")
    .notNull()
    .unique()
    .references(() => WorkflowTable.id, { onDelete: "cascade" }),
  name: text("name"),
  logoS3ObjectKey: text("logo_s3_object_key"),
  coverS3ObjectKey: text("cover_s3_object_key"),
  showCoverImage: boolean("show_cover_image").notNull().default(false),
  brandingMainColor: text("branding_main_color"),
  brandingCtaColor: text("branding_cta_color"),
  brandingSecondaryColor: text("branding_secondary_color"),
  bottomContentTitle: text("bottom_content_title"),
  bottomContentLink: text("bottom_content_link"),
  bottomContentDescription: text("bottom_content_description"),
  // Domains allowed to embed the widget — enforced by the SDK loader.
  hosts: json("hosts").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Runtime instances — one per customer KYC attempt against a workflow.
export const WorkflowSessionTable = pgTable(
  "workflow_session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId("workflowsession")),
    externalSessionId: text("external_session_id").notNull(),
    externalSessionSource: text("external_session_source")
      .$type<ExternalSessionSource>()
      .notNull(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => WorkflowTable.id),
    customerId: text("customer_id").notNull(),
    verificationMode: workflowVerificationModeEnum("verification_mode")
      .notNull()
      .default("sandbox"),
    activeDeviceId: text("active_device_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueSession: unique("workflow_session_unique").on(
      table.externalSessionId,
      table.externalSessionSource,
      table.workflowId,
      table.customerId,
      table.verificationMode,
    ),
    externalSessionIdIdx: index("workflow_session_external_id_idx").on(
      table.externalSessionId,
    ),
    customerIdx: index("workflow_session_customer_idx").on(table.customerId),
  }),
);

// Status log per session per granular step (top-level steps + sub-steps).
export const WorkflowSessionStepTable = pgTable(
  "workflow_session_step",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId("workflowsessionstep")),
    sessionId: text("session_id")
      .notNull()
      .references(() => WorkflowSessionTable.id, { onDelete: "cascade" }),
    step: text("step").$type<WorkflowSessionStepType>().notNull(),
    status: text("status").$type<WorkflowSessionStatus>().notNull(),
    message: text("message"),
    traceId: text("trace_id"),
    parentStepId: text("parent_step_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueSessionStep: unique("workflow_session_step_unique").on(
      table.sessionId,
      table.step,
    ),
  }),
);

// EAV — verified data extracted per workflow session. Keys are dot-namespaced
// strings (e.g. "identity_verification.document_number"); values stored as
// text and cast on read using attributeType. Same schema regardless of whether
// data came from a provider webhook or a manual reviewer.
export const WorkflowSessionAttributeTable = pgTable(
  "workflow_session_attribute",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId("workflowsessionattribute")),
    workflowSessionId: text("workflow_session_id")
      .notNull()
      .references(() => WorkflowSessionTable.id, { onDelete: "cascade" }),
    attribute: text("attribute").notNull(),
    value: text("value").notNull(),
    attributeType: text("attribute_type").$type<AttributeType>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueSessionAttribute: unique("workflow_session_attribute_unique").on(
      table.workflowSessionId,
      table.attribute,
    ),
  }),
);

// Per-organization credentials + toggle for each external provider. Source
// of truth for the dashboard's Providers page; the runtime dispatcher still
// reads from env credentials today (a per-org runtime fetch is a future
// task) but the data model is correct from day one so the migration path
// is straightforward.
export const ProviderConfigurationTable = pgTable(
  "provider_configuration",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId("providerconfig")),
    organizationId: text("organization_id").notNull(),
    provider: providerShortNameEnum("provider").notNull(),
    apiKey: text("api_key"),
    apiSecret: text("api_secret"),
    enabled: boolean("enabled").notNull().default(false),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueOrgProvider: unique("provider_configuration_unique_org_provider").on(
      table.organizationId,
      table.provider,
    ),
    organizationIdx: index("provider_configuration_organization_idx").on(
      table.organizationId,
    ),
  }),
);

export type Workflow = typeof WorkflowTable.$inferSelect;
export type NewWorkflow = typeof WorkflowTable.$inferInsert;
export type WorkflowStep = typeof WorkflowStepTable.$inferSelect;
export type NewWorkflowStep = typeof WorkflowStepTable.$inferInsert;
export type IdentityVerificationStep =
  typeof IdentityVerificationStepTable.$inferSelect;
export type IdentityVerificationSubStep =
  typeof IdentityVerificationSubStepTable.$inferSelect;
export type AmlScreeningStep = typeof AmlScreeningStepTable.$inferSelect;
export type FraudDetectionStep = typeof FraudDetectionStepTable.$inferSelect;
export type DuplicateDetectionStep =
  typeof DuplicateDetectionStepTable.$inferSelect;
export type RulesEngineStep = typeof RulesEngineStepTable.$inferSelect;
export type RulesEngineScenario = typeof RulesEngineScenarioTable.$inferSelect;
export type IdentityWidget = typeof IdentityWidgetTable.$inferSelect;
export type WorkflowSession = typeof WorkflowSessionTable.$inferSelect;
export type WorkflowSessionStep = typeof WorkflowSessionStepTable.$inferSelect;
export type WorkflowSessionAttribute =
  typeof WorkflowSessionAttributeTable.$inferSelect;
export type ProviderConfiguration =
  typeof ProviderConfigurationTable.$inferSelect;
export type NewProviderConfiguration =
  typeof ProviderConfigurationTable.$inferInsert;
