// Session step state-machine and the dashboard-facing read surface that hangs
// off it. The recordStepStatus path is where every transition lands — from the
// widget's "in progress" ping to a provider check flipping an approved
// customer back into review. These tests pin the state shape (no extra rows on
// idempotent re-record), the adverse-transition demotion guard, and the
// queue + activity-timeline projections that read off it.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { bootTestApp, type TestApp } from "./utils/testApp";
import {
  seedDefaultTenant,
  seedIdentityVerificationSubSteps,
  seedSession,
  seedSessionAttribute,
  seedSessionStep,
  seedTenantWithSteps,
  seedWorkflowStep,
} from "./utils/seed";
import { WorkflowSessionStepTable, WorkflowSessionTable } from "../src/db/schema.db";
import { and, eq } from "drizzle-orm";

const postStep = async (
  ctx: TestApp,
  sessionId: string,
  body: { step: string; status: string; message?: string | null },
) =>
  ctx.request(`/workflows/workflow-sessions/${sessionId}/steps`, {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("POST /workflow-sessions/:id/steps — state machine", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("recording identity-verification = IN_PROGRESS creates the row", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_lifecycle_start",
    });

    const res = await postStep(ctx, session.id, {
      step: "identity-verification",
      status: "IN_PROGRESS",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.step).toBe("identity-verification");
    expect(body.status).toBe("IN_PROGRESS");
    expect(body.sessionId).toBe(session.id);
  });

  test("IN_PROGRESS → REQUIRES_REVIEW transition persists and shows in detail", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_submitted",
    });
    await postStep(ctx, session.id, {
      step: "identity-verification",
      status: "IN_PROGRESS",
    });
    await postStep(ctx, session.id, {
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const iv = detail.steps.find(
      (s: { step: string }) => s.step === "identity-verification",
    );
    expect(iv.status).toBe("REQUIRES_REVIEW");
  });

  test("REQUIRES_REVIEW → SUCCEEDED transition (reviewer approves)", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_approved",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    const res = await postStep(ctx, session.id, {
      step: "identity-verification",
      status: "SUCCEEDED",
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("SUCCEEDED");
  });

  test("REQUIRES_REVIEW → FAILED transition (reviewer rejects)", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_rejected",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    const res = await postStep(ctx, session.id, {
      step: "identity-verification",
      status: "FAILED",
      message: "document mismatch",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("FAILED");
    expect(body.message).toBe("document mismatch");
  });

  test("FAILED aml-screening on an approved customer flips identity back to REQUIRES_REVIEW", async () => {
    const tenant = await seedTenantWithSteps(ctx.db, {
      additionalSteps: [{ step: "aml-screening", provider: "complyAdvantage" }],
    });
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_aml_hit",
    });
    // Customer already approved at onboarding.
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "SUCCEEDED",
    });
    await postStep(ctx, session.id, {
      step: "aml-screening",
      status: "FAILED",
      message: "PEP match",
    });

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const iv = detail.steps.find(
      (s: { step: string }) => s.step === "identity-verification",
    );
    const aml = detail.steps.find(
      (s: { step: string }) => s.step === "aml-screening",
    );
    expect(iv.status).toBe("REQUIRES_REVIEW");
    expect(aml.status).toBe("FAILED");
  });

  test("duplicate-detection = REQUIRES_REVIEW also demotes an approved customer", async () => {
    const tenant = await seedTenantWithSteps(ctx.db, {
      additionalSteps: [{ step: "duplicate-detection" }],
    });
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_dup_hit",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "SUCCEEDED",
    });
    // duplicate-detection lands on REQUIRES_REVIEW (never FAILED) per service.
    // The adverse-transition check covers both FAILED and REQUIRES_REVIEW for
    // check steps, so an already-approved customer gets demoted back here too
    // — whether the duplicate result came from the in-house runner or from a
    // reviewer recording it directly via /steps.
    await postStep(ctx, session.id, {
      step: "duplicate-detection",
      status: "REQUIRES_REVIEW",
    });

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const iv = detail.steps.find(
      (s: { step: string }) => s.step === "identity-verification",
    );
    expect(iv.status).toBe("REQUIRES_REVIEW");
    const dup = detail.steps.find(
      (s: { step: string }) => s.step === "duplicate-detection",
    );
    expect(dup.status).toBe("REQUIRES_REVIEW");
  });

  test("re-recording the same step+status is idempotent (no duplicate row)", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_idempotent",
    });
    await postStep(ctx, session.id, {
      step: "identity-verification",
      status: "IN_PROGRESS",
    });
    await postStep(ctx, session.id, {
      step: "identity-verification",
      status: "IN_PROGRESS",
    });
    const rows = await ctx.db
      .select()
      .from(WorkflowSessionStepTable)
      .where(
        and(
          eq(WorkflowSessionStepTable.sessionId, session.id),
          eq(WorkflowSessionStepTable.step, "identity-verification"),
        ),
      );
    expect(rows.length).toBe(1);
  });
});

describe("GET /workflow-sessions/workspace/:workspaceId — listing", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("returns only the requested workspace's sessions", async () => {
    const tenantA = await seedDefaultTenant(ctx.db);
    const tenantB = await seedDefaultTenant(ctx.db);
    await seedSession(ctx.db, {
      workspaceId: tenantA.workflow.workspaceId,
      organizationId: tenantA.workflow.organizationId,
      workflowId: tenantA.workflow.id,
      customerId: "cust_in_a_1",
    });
    await seedSession(ctx.db, {
      workspaceId: tenantA.workflow.workspaceId,
      organizationId: tenantA.workflow.organizationId,
      workflowId: tenantA.workflow.id,
      customerId: "cust_in_a_2",
    });
    await seedSession(ctx.db, {
      workspaceId: tenantB.workflow.workspaceId,
      organizationId: tenantB.workflow.organizationId,
      workflowId: tenantB.workflow.id,
      customerId: "cust_in_b",
    });

    const res = await ctx.request(
      `/workflows/workflow-sessions/workspace/${tenantA.workflow.workspaceId}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    const customerIds = body.map((s: { customerId: string }) => s.customerId);
    expect(customerIds).toContain("cust_in_a_1");
    expect(customerIds).toContain("cust_in_a_2");
    expect(customerIds).not.toContain("cust_in_b");
  });

  test("review-queue lists sessions in REQUIRES_REVIEW and IN_PROGRESS, not SUCCEEDED", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const reviewSession = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_queue_review",
    });
    await seedSessionStep(ctx.db, {
      sessionId: reviewSession.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    const progressSession = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_queue_progress",
    });
    await seedSessionStep(ctx.db, {
      sessionId: progressSession.id,
      step: "identity-verification",
      status: "IN_PROGRESS",
    });
    const approvedSession = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_queue_approved",
    });
    await seedSessionStep(ctx.db, {
      sessionId: approvedSession.id,
      step: "identity-verification",
      status: "SUCCEEDED",
    });

    const openRes = await ctx.request(
      `/workflows/workflow-sessions/workspace/${tenant.workflow.workspaceId}/review-queue?status=open`,
    );
    expect(openRes.status).toBe(200);
    const openBody = await openRes.json();
    const openIds = openBody.items.map(
      (s: { customerId: string }) => s.customerId,
    );
    expect(openIds).toContain("cust_queue_review");
    expect(openIds).toContain("cust_queue_progress");
    expect(openIds).not.toContain("cust_queue_approved");
  });
});

describe("Activity timeline + outstanding work", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("decision events surface on the activity timeline (events array)", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_timeline",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    await ctx.request(`/workflows/workflow-sessions/${session.id}/finalize`, {
      method: "POST",
      body: JSON.stringify({ decision: "approved", reviewedBy: "officer_1" }),
    });

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    expect(Array.isArray(detail.events)).toBe(true);
    const decisionEvent = detail.events.find(
      (e: { type: string }) => e.type === "decision",
    );
    expect(decisionEvent).toBeDefined();
    expect(decisionEvent.detail.decision).toBe("approved");
    expect(decisionEvent.createdBy).toBe("officer_1");
  });

  test("recording a step on an archived session returns 410 — archived sessions are immutable", async () => {
    // Archived sessions are retention/audit artifacts — they keep the audit
    // trail of every reviewer action but never grow new step rows. The
    // service throws SessionArchivedError; the route surfaces it as 410 Gone.
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_archived",
    });
    await ctx.db
      .update(WorkflowSessionTable)
      .set({
        deletedAt: new Date(),
        deletedBy: "officer_1",
        deleteReason: "test archive",
      })
      .where(eq(WorkflowSessionTable.id, session.id));

    const res = await postStep(ctx, session.id, {
      step: "identity-verification",
      status: "IN_PROGRESS",
    });
    expect(res.status).toBe(410);
  });

  test("outstanding reflects sub-steps + server checks remaining for the workflow", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    // Wire id-scan + face-scan as enabled sub-steps + a duplicate-detection
    // server check on the workflow.
    const ivWorkflowStep = await ctx.db.query.WorkflowStepTable.findFirst({
      where: (t, { and: a, eq: e }) =>
        a(e(t.workflowId, tenant.workflow.id), e(t.type, "identity-verification")),
    });
    await seedIdentityVerificationSubSteps(ctx.db, {
      workflowStepId: ivWorkflowStep!.id,
      enabled: ["id-scan", "face-scan"],
    });
    await seedWorkflowStep(ctx.db, {
      workflowId: tenant.workflow.id,
      step: "duplicate-detection",
    });
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_outstanding",
    });

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    expect(detail.outstanding.steps).toContain("id-scan");
    expect(detail.outstanding.steps).toContain("face-scan");
    expect(detail.outstanding.checks).toContain("duplicate-detection");

    // Marking face-scan complete shrinks the outstanding set.
    await seedSessionAttribute(ctx.db, {
      sessionId: session.id,
      attribute: "identity_verification.liveness_passed",
      value: "true",
      attributeType: "BOOLEAN",
    });
    const detail2 = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    expect(detail2.outstanding.steps).not.toContain("face-scan");
    expect(detail2.outstanding.steps).toContain("id-scan");
  });
});
