// Reviewer decision (approve / reject / flag) via POST /finalize. This is the
// terminal handoff to identity-api over rabbit — we lock in the published
// payload shape (so identity-api can populate the customer profile), the
// idempotency contract, and the step-status mirror onto the session so a
// customer who reopens the widget sees the outcome. Decisions also append a
// row to the audit timeline so the dashboard can replay every approve/reject.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { bootTestApp, type TestApp } from "./utils/testApp";
import {
  seedDefaultTenant,
  seedSession,
  seedSessionAttribute,
  seedSessionStep,
} from "./utils/seed";
import { WorkflowTable } from "../src/db/schema.db";

const finalize = (
  ctx: TestApp,
  sessionId: string,
  body: Record<string, unknown>,
) =>
  ctx.request(`/workflows/workflow-sessions/${sessionId}/finalize`, {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("POST /workflow-sessions/:id/finalize — decisions", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("approve flips identity-verification to SUCCEEDED and publishes kyc.completed=approved", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_approve",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });

    const res = await finalize(ctx, session.id, {
      decision: "approved",
      reviewedBy: "officer_1",
    });
    expect(res.status).toBe(200);

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const iv = detail.steps.find(
      (s: { step: string }) => s.step === "identity-verification",
    );
    expect(iv.status).toBe("SUCCEEDED");

    const event = ctx.rabbit.published.find(
      (p) => p.routingKey === "kyc.completed",
    );
    expect(event).toBeDefined();
    const payload = event!.payload as { status: string; customerId: string };
    expect(payload.status).toBe("approved");
    expect(payload.customerId).toBe("cust_approve");
  });

  test("reject flips identity-verification to FAILED and publishes kyc.completed=rejected with reason", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_reject",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });

    const res = await finalize(ctx, session.id, {
      decision: "rejected",
      reviewedBy: "officer_1",
      reason: "ID photo unreadable",
    });
    expect(res.status).toBe(200);

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const iv = detail.steps.find(
      (s: { step: string }) => s.step === "identity-verification",
    );
    expect(iv.status).toBe("FAILED");
    expect(iv.message).toContain("ID photo unreadable");

    const event = ctx.rabbit.published.find(
      (p) => p.routingKey === "kyc.completed",
    );
    expect(event).toBeDefined();
    const payload = event!.payload as { status: string; reason?: string };
    expect(payload.status).toBe("rejected");
    expect(payload.reason).toBe("ID photo unreadable");
  });

  test("flag keeps identity-verification in REQUIRES_REVIEW; kyc.completed publishes with status=flagged", async () => {
    // "flagged" still publishes — identity-api treats it as a non-terminal
    // signal. Only the step status differs (REQUIRES_REVIEW, not SUCCEEDED /
    // FAILED), keeping the session in the review queue.
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_flagged",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });

    const res = await finalize(ctx, session.id, {
      decision: "flagged",
      reviewedBy: "officer_1",
    });
    expect(res.status).toBe(200);
    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const iv = detail.steps.find(
      (s: { step: string }) => s.step === "identity-verification",
    );
    expect(iv.status).toBe("REQUIRES_REVIEW");

    const event = ctx.rabbit.published.find(
      (p) => p.routingKey === "kyc.completed",
    );
    expect(event).toBeDefined();
    const payload = event!.payload as { status: string };
    expect(payload.status).toBe("flagged");
  });

  test("reason codes ride through into attributes and the kyc.completed reason text", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_reasons",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });

    const res = await finalize(ctx, session.id, {
      decision: "rejected",
      reviewedBy: "officer_1",
      reasonCodes: ["DOCUMENT_EXPIRED"],
      reason: "expired by 2 years",
    });
    expect(res.status).toBe(200);

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const reasonsAttr = detail.attributes.find(
      (a: { attribute: string }) => a.attribute === "_session.reject_reasons",
    );
    expect(reasonsAttr).toBeDefined();
    expect(reasonsAttr.value).toBe("DOCUMENT_EXPIRED");

    const event = ctx.rabbit.published.find(
      (p) => p.routingKey === "kyc.completed",
    );
    expect(event).toBeDefined();
    const payload = event!.payload as { reason?: string };
    // Combined reason: label + free-text, separated by an em-dash style join.
    expect(payload.reason).toContain("expired by 2 years");
  });

  test("finalizing the same decision twice publishes two events but converges on the same state", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_idempotent_decision",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    await finalize(ctx, session.id, {
      decision: "approved",
      reviewedBy: "officer_1",
    });
    await finalize(ctx, session.id, {
      decision: "approved",
      reviewedBy: "officer_1",
    });

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const iv = detail.steps.find(
      (s: { step: string }) => s.step === "identity-verification",
    );
    // State convergence — still SUCCEEDED, no extra step rows.
    expect(iv.status).toBe("SUCCEEDED");
    // Audit trail keeps every round so the timeline shows re-decisions.
    const decisionEvents = detail.events.filter(
      (e: { type: string }) => e.type === "decision",
    );
    expect(decisionEvents.length).toBe(2);
  });

  test("kyc.completed payload includes firstName + lastName + country from session attributes", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_payload_shape",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    await seedSessionAttribute(ctx.db, {
      sessionId: session.id,
      attribute: "identity_verification.document_first_name",
      value: "Anja",
    });
    await seedSessionAttribute(ctx.db, {
      sessionId: session.id,
      attribute: "identity_verification.document_last_name",
      value: "Novak",
    });
    await seedSessionAttribute(ctx.db, {
      sessionId: session.id,
      attribute: "identity_verification.country_of_residence",
      value: "SVN",
    });

    await finalize(ctx, session.id, {
      decision: "approved",
      reviewedBy: "officer_1",
    });

    const event = ctx.rabbit.published.find(
      (p) => p.routingKey === "kyc.completed",
    );
    expect(event).toBeDefined();
    const payload = event!.payload as {
      firstName?: string;
      lastName?: string;
      country?: string;
    };
    expect(payload.firstName).toBe("Anja");
    expect(payload.lastName).toBe("Novak");
    expect(payload.country).toBe("SVN");
  });

  test("kyc.completed workspaceId is the workflow's workspace, not the caller's", async () => {
    // Finalize is a dashboard-side action; the payload's workspaceId must
    // come off the workflow so identity-api routes the profile update to the
    // right workspace even if the dashboard's auth context says otherwise.
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_ws_check",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    await finalize(ctx, session.id, {
      decision: "approved",
      reviewedBy: "officer_1",
    });

    const event = ctx.rabbit.published.find(
      (p) => p.routingKey === "kyc.completed",
    );
    const payload = event!.payload as { workspaceId: string };
    expect(payload.workspaceId).toBe(tenant.workflow.workspaceId);
  });

  test("finalizing a session with no identity-verification step yet still works (upserts the step)", async () => {
    // Service uses upsert for the step transition — there's no precondition
    // that the step row pre-exist. Pin that behavior so a customer who
    // finalizes a session before the widget ever ticked it doesn't 500.
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_no_iv_step",
    });
    const res = await finalize(ctx, session.id, {
      decision: "approved",
      reviewedBy: "officer_1",
    });
    expect(res.status).toBe(200);
    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const iv = detail.steps.find(
      (s: { step: string }) => s.step === "identity-verification",
    );
    expect(iv.status).toBe("SUCCEEDED");
  });

  test("finalizing a session on a soft-deleted workflow still succeeds (audit retention)", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_deleted_workflow",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    // Soft-delete the workflow — service uses findByIdIncludingDeleted so the
    // session's parent still resolves for the finalize path.
    await ctx.db
      .update(WorkflowTable)
      .set({ deletedAt: new Date() })
      .where(eq(WorkflowTable.id, tenant.workflow.id));

    const res = await finalize(ctx, session.id, {
      decision: "approved",
      reviewedBy: "officer_1",
    });
    expect(res.status).toBe(200);
    const event = ctx.rabbit.published.find(
      (p) => p.routingKey === "kyc.completed",
    );
    expect(event).toBeDefined();
  });

  test("finalizing a session that doesn't exist returns 404", async () => {
    const res = await finalize(ctx, "wkfsession_does_not_exist", {
      decision: "approved",
      reviewedBy: "officer_1",
    });
    expect(res.status).toBe(404);
  });
});
