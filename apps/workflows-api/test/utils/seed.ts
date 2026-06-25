import { createHash, randomBytes, randomUUID } from "node:crypto";

import type {
  AttributeType,
  IdentityVerificationSubStepType,
  WorkflowSessionStatus,
} from "@usercore/shared-types";
import { IDENTITY_VERIFICATION_SUB_STEP_TYPES } from "@usercore/shared-types";

import type { Database } from "../../src/db/db";
import {
  ApiKeyTable,
  IdentityVerificationStepTable,
  IdentityVerificationSubStepTable,
  WorkflowSessionAttributeTable,
  WorkflowSessionStepTable,
  WorkflowSessionTable,
  WorkflowStepTable,
  WorkflowTable,
} from "../../src/db/schema.db";

// Seed helpers. Tests insert directly via Drizzle — no factory library, just
// thin wrappers that return the freshly-created row so a test can chain.

const RAW_PREFIX = "uc_";
const generateRawKey = () =>
  `${RAW_PREFIX}${randomBytes(24).toString("base64url")}`;
const hashKey = (raw: string) => createHash("sha256").update(raw).digest("hex");

export const seedApiKey = async (
  db: Database,
  data: { workspaceId: string; organizationId: string; name?: string },
): Promise<{ id: string; secret: string }> => {
  const secret = generateRawKey();
  const [row] = await db
    .insert(ApiKeyTable)
    .values({
      workspaceId: data.workspaceId,
      organizationId: data.organizationId,
      name: data.name ?? "Test key",
      keyPrefix: secret.slice(0, RAW_PREFIX.length + 8),
      keyHash: hashKey(secret),
      createdBy: null,
    })
    .returning();
  return { id: row.id, secret };
};

export const seedWorkflow = async (
  db: Database,
  data: {
    workspaceId: string;
    organizationId: string;
    displayName?: string;
    isDefault?: boolean;
    verificationMode?: "sandbox" | "production";
  },
) => {
  const [row] = await db
    .insert(WorkflowTable)
    .values({
      workspaceId: data.workspaceId,
      organizationId: data.organizationId,
      displayName: data.displayName ?? "Test workflow",
      type: "USER_KYC",
      isDefault: data.isDefault ?? false,
      verificationMode: data.verificationMode ?? "sandbox",
    })
    .returning();
  return row;
};

export const seedWorkflowStep = async (
  db: Database,
  data: {
    workflowId: string;
    step: "identity-verification" | "aml-screening" | "fraud-detection" | "duplicate-detection" | "rules-engine";
    provider?: string | null;
  },
) => {
  const [row] = await db
    .insert(WorkflowStepTable)
    .values({
      workflowId: data.workflowId,
      type: data.step,
      provider: data.provider ?? null,
    })
    .returning();
  return row;
};

export const seedSession = async (
  db: Database,
  data: {
    workspaceId: string;
    organizationId: string;
    workflowId: string;
    customerId: string;
    externalSessionId?: string;
  },
) => {
  const [row] = await db
    .insert(WorkflowSessionTable)
    .values({
      externalSessionId: data.externalSessionId ?? `ext_${randomUUID()}`,
      externalSessionSource: "widget",
      workflowId: data.workflowId,
      customerId: data.customerId,
      verificationMode: "sandbox",
    })
    .returning();
  return row;
};

export const seedSessionStep = async (
  db: Database,
  data: {
    sessionId: string;
    step: string;
    status: WorkflowSessionStatus;
  },
) => {
  const [row] = await db
    .insert(WorkflowSessionStepTable)
    .values({
      sessionId: data.sessionId,
      step: data.step as never,
      status: data.status,
    })
    .returning();
  return row;
};

export const seedSessionAttribute = async (
  db: Database,
  data: {
    sessionId: string;
    attribute: string;
    value: string;
    attributeType?: AttributeType;
  },
) => {
  const [row] = await db
    .insert(WorkflowSessionAttributeTable)
    .values({
      workflowSessionId: data.sessionId,
      attribute: data.attribute,
      value: data.value,
      attributeType: data.attributeType ?? "STRING",
    })
    .returning();
  return row;
};

// Seed the identity-verification step row + a chosen set of enabled sub-steps.
// Required when a test inspects `outstanding.steps` or `enabledSteps` — the
// detail route walks the iv → sub-step graph, so without these rows it returns
// empty arrays.
export const seedIdentityVerificationSubSteps = async (
  db: Database,
  data: {
    workflowStepId: string;
    enabled: IdentityVerificationSubStepType[];
  },
) => {
  const [ivStep] = await db
    .insert(IdentityVerificationStepTable)
    .values({ workflowStepId: data.workflowStepId })
    .returning();
  const enabledSet = new Set<string>(data.enabled);
  const rows = await db
    .insert(IdentityVerificationSubStepTable)
    .values(
      IDENTITY_VERIFICATION_SUB_STEP_TYPES.map((type) => ({
        type,
        enabled: enabledSet.has(type),
        valid: enabledSet.has(type),
        identityVerificationStepId: ivStep!.id,
      })),
    )
    .returning();
  return { step: ivStep!, subSteps: rows };
};

// A common second-tenant shape used by review-queue / cross-workspace tests:
// every tenant gets its own org + workspace + default workflow + identity step.
// `additionalSteps` lets a test attach extra check steps (aml/fraud/duplicate)
// to the workflow without re-doing the boilerplate.
export const seedTenantWithSteps = async (
  db: Database,
  opts?: {
    additionalSteps?: Array<{
      step: "aml-screening" | "fraud-detection" | "duplicate-detection" | "rules-engine";
      provider?: string | null;
    }>;
    enabledSubSteps?: IdentityVerificationSubStepType[];
  },
) => {
  const tenant = await seedDefaultTenant(db);
  const ivStep = await db.query.WorkflowStepTable.findFirst({
    where: (t, { and, eq }) =>
      and(eq(t.workflowId, tenant.workflow.id), eq(t.type, "identity-verification")),
  });
  if (opts?.enabledSubSteps && ivStep) {
    await seedIdentityVerificationSubSteps(db, {
      workflowStepId: ivStep.id,
      enabled: opts.enabledSubSteps,
    });
  }
  for (const extra of opts?.additionalSteps ?? []) {
    await seedWorkflowStep(db, {
      workflowId: tenant.workflow.id,
      step: extra.step,
      provider: extra.provider ?? null,
    });
  }
  return tenant;
};

// Seeds a session that already has a verified email on it — the exact shape
// the duplicate-email guard checks against. Lets email-otp tests preload a
// "someone else already registered this address" scenario without going
// through the full OTP round-trip first.
export const seedVerifiedEmailSession = async (
  db: Database,
  data: {
    workspaceId: string;
    organizationId: string;
    workflowId: string;
    customerId: string;
    email: string;
  },
) => {
  const session = await seedSession(db, {
    workspaceId: data.workspaceId,
    organizationId: data.organizationId,
    workflowId: data.workflowId,
    customerId: data.customerId,
  });
  await seedSessionAttribute(db, {
    sessionId: session.id,
    attribute: "email_verification.email",
    value: data.email,
  });
  return session;
};

// A common starter shape: an org + workspace + default workflow with the
// identity-verification step enabled + an active API key. Most tests need
// this exact graph before they can do anything useful.
export const seedDefaultTenant = async (db: Database) => {
  const workspaceId = `ws_${randomUUID().slice(0, 8)}`;
  const organizationId = `org_${randomUUID().slice(0, 8)}`;
  const workflow = await seedWorkflow(db, {
    workspaceId,
    organizationId,
    displayName: "Default test workflow",
    isDefault: true,
  });
  await seedWorkflowStep(db, {
    workflowId: workflow.id,
    step: "identity-verification",
    provider: "idenfy",
  });
  const apiKey = await seedApiKey(db, { workspaceId, organizationId });
  return { workspaceId, organizationId, workflow, apiKey };
};
