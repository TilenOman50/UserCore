// Reviewer bounces a session back to the customer to redo specific identity
// sub-steps. Tests cover the wipe-and-replace contract (cleared captured data,
// reset reviewer verdicts), the markers the widget reads on resume, the
// append-only audit row that survives multiple rounds, and the queue state
// flip out of "approved".

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { bootTestApp, type TestApp } from "./utils/testApp";
import {
  seedDefaultTenant,
  seedSession,
  seedSessionAttribute,
  seedSessionStep,
} from "./utils/seed";

const requestResubmission = (
  ctx: TestApp,
  sessionId: string,
  body: Record<string, unknown>,
) =>
  ctx.request(
    `/workflows/workflow-sessions/${sessionId}/request-resubmission`,
    { method: "POST", body: JSON.stringify(body) },
  );

describe("POST /workflow-sessions/:id/request-resubmission", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("clears the bounced steps' attributes and pulls identity back to IN_PROGRESS", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_resub_clear",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    // Captured ID + face attributes from the first attempt; these must be
    // wiped so the customer's NEW submission stands on its own.
    await seedSessionAttribute(ctx.db, {
      sessionId: session.id,
      attribute: "identity_verification.document_number",
      value: "AB123",
    });
    await seedSessionAttribute(ctx.db, {
      sessionId: session.id,
      attribute: "identity_verification.liveness_passed",
      value: "true",
      attributeType: "BOOLEAN",
    });

    const res = await requestResubmission(ctx, session.id, {
      steps: ["id-scan", "face-scan"],
      reviewedBy: "officer_1",
      reasonCodes: [],
    });
    expect(res.status).toBe(200);

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const iv = detail.steps.find(
      (s: { step: string }) => s.step === "identity-verification",
    );
    expect(iv.status).toBe("IN_PROGRESS");

    const docNumberAttr = detail.attributes.find(
      (a: { attribute: string }) =>
        a.attribute === "identity_verification.document_number",
    );
    expect(docNumberAttr).toBeUndefined();
    const livenessAttr = detail.attributes.find(
      (a: { attribute: string }) =>
        a.attribute === "identity_verification.liveness_passed",
    );
    expect(livenessAttr).toBeUndefined();
  });

  test("appends a resubmission_requested audit event with steps, reason, and snapshot", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_resub_event",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    await seedSessionAttribute(ctx.db, {
      sessionId: session.id,
      attribute: "identity_verification.document_number",
      value: "AB123",
    });

    await requestResubmission(ctx, session.id, {
      steps: ["id-scan"],
      reviewedBy: "officer_42",
      reasonCodes: ["DOCUMENT_BLURRY"],
      note: "Photo is too dark",
    });

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const event = detail.events.find(
      (e: { type: string }) => e.type === "resubmission_requested",
    );
    expect(event).toBeDefined();
    expect(event.detail.steps).toEqual(["id-scan"]);
    expect(event.detail.reasonCodes).toEqual(["DOCUMENT_BLURRY"]);
    expect(event.detail.note).toBe("Photo is too dark");
    // Snapshot preserves what was cleared so the next attempt can be
    // compared against the prior one (identity-swap guard).
    expect(event.detail.snapshot["identity_verification.document_number"]).toBe(
      "AB123",
    );
    expect(event.createdBy).toBe("officer_42");
  });

  test("resubmission for a step with no clear-list (contact-information) is a no-op on attributes", async () => {
    // Self-verifying steps aren't in RESUBMISSION_CLEAR_ATTRIBUTES — the
    // service simply records markers + event without wiping captured data.
    // Pin that behavior so a future broadening is intentional.
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_resub_contact",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    await seedSessionAttribute(ctx.db, {
      sessionId: session.id,
      attribute: "contact_information.email",
      value: "anja@example.com",
    });

    const res = await requestResubmission(ctx, session.id, {
      steps: ["contact-information"],
      reviewedBy: "officer_1",
      reasonCodes: [],
    });
    expect(res.status).toBe(200);

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const emailAttr = detail.attributes.find(
      (a: { attribute: string }) => a.attribute === "contact_information.email",
    );
    // Email is preserved (would otherwise break the resubmission email
    // address lookup).
    expect(emailAttr).toBeDefined();
    expect(emailAttr.value).toBe("anja@example.com");
  });

  test("after resubmission the session is no longer in 'approved' review state", async () => {
    // Resubmission marker flips the queue projection out of approved into
    // the "resubmission" review-status bucket.
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_resub_queue",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "SUCCEEDED",
    });

    await requestResubmission(ctx, session.id, {
      steps: ["id-scan"],
      reviewedBy: "officer_1",
      reasonCodes: [],
    });

    const queue = await ctx
      .request(
        `/workflows/workflow-sessions/workspace/${tenant.workflow.workspaceId}/review-queue?status=resubmission`,
      )
      .then((r) => r.json());
    const ids = queue.items.map((s: { id: string }) => s.id);
    expect(ids).toContain(session.id);
  });

  test("multiple resubmission rounds — each round appends its own audit row", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_resub_rounds",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    await requestResubmission(ctx, session.id, {
      steps: ["id-scan"],
      reviewedBy: "officer_1",
      reasonCodes: ["DOCUMENT_BLURRY"],
    });
    // Customer "resubmits" — we just bump identity back to REQUIRES_REVIEW so
    // the reviewer can bounce it again.
    await ctx.request(`/workflows/workflow-sessions/${session.id}/steps`, {
      method: "POST",
      body: JSON.stringify({
        step: "identity-verification",
        status: "REQUIRES_REVIEW",
      }),
    });
    await requestResubmission(ctx, session.id, {
      steps: ["face-scan"],
      reviewedBy: "officer_1",
      reasonCodes: ["FACE_NOT_VISIBLE"],
    });

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const rounds = detail.events.filter(
      (e: { type: string }) => e.type === "resubmission_requested",
    );
    expect(rounds.length).toBe(2);
  });

  test("requesting resubmission for a non-existent session returns 404", async () => {
    // Service returns null when the session lookup misses; the route surfaces
    // that as 404 instead of silently 200-ing — calling with a stale
    // sessionId is almost always a client bug, not an intentional no-op.
    const res = await requestResubmission(ctx, "wkfsession_nope", {
      steps: ["id-scan"],
      reviewedBy: "officer_1",
      reasonCodes: [],
    });
    expect(res.status).toBe(404);
  });

  test("resubmission with empty reasonCodes still records the event", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_resub_no_reasons",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    const res = await requestResubmission(ctx, session.id, {
      steps: ["id-scan"],
      reviewedBy: "officer_1",
      reasonCodes: [],
    });
    expect(res.status).toBe(200);

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const event = detail.events.find(
      (e: { type: string }) => e.type === "resubmission_requested",
    );
    expect(event).toBeDefined();
    expect(event.detail.reasonCodes).toEqual([]);
  });

  test("a custom note rides into the event detail unchanged", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_resub_note",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    await requestResubmission(ctx, session.id, {
      steps: ["id-scan"],
      reviewedBy: "officer_1",
      reasonCodes: [],
      note: "Please retake in better lighting",
    });

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const event = detail.events.find(
      (e: { type: string }) => e.type === "resubmission_requested",
    );
    expect(event.detail.note).toBe("Please retake in better lighting");
  });

  test("omitted note resolves to null in the event detail", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_resub_nullnote",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    await requestResubmission(ctx, session.id, {
      steps: ["id-scan"],
      reviewedBy: "officer_1",
      reasonCodes: [],
    });
    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    const event = detail.events.find(
      (e: { type: string }) => e.type === "resubmission_requested",
    );
    expect(event.detail.note).toBeNull();
  });

  test("events array is oldest-first; the resubmission event lands last after earlier events", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_resub_order",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    // First event: a decision (flagged → still in review).
    await ctx.request(`/workflows/workflow-sessions/${session.id}/finalize`, {
      method: "POST",
      body: JSON.stringify({ decision: "flagged", reviewedBy: "officer_1" }),
    });
    // Second event: resubmission requested.
    await requestResubmission(ctx, session.id, {
      steps: ["id-scan"],
      reviewedBy: "officer_1",
      reasonCodes: [],
    });

    const detail = await ctx
      .request(`/workflows/workflow-sessions/${session.id}`)
      .then((r) => r.json());
    expect(detail.events.length).toBeGreaterThanOrEqual(2);
    const types = detail.events.map((e: { type: string }) => e.type);
    expect(types[types.length - 1]).toBe("resubmission_requested");
  });
});
