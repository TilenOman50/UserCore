// Email OTP send + verify — the widget's email-verification step. Tests run
// against the FakeMailer wired into testApp so a send becomes an entry in
// `mailer.verificationOtpCalls` instead of an SMTP socket; the OTP itself is
// captured from that recorded call to drive the verify step. See
// utils/testApp.ts for the fake mailer wiring.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { bootTestApp, type TestApp } from "./utils/testApp";
import {
  seedDefaultTenant,
  seedSession,
  seedVerifiedEmailSession,
} from "./utils/seed";

describe("POST /workflows/workflow-sessions/:id/email-otp/send", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("stores the OTP on the session and records a mailer call", async () => {
    const { workflow } = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: workflow.workspaceId,
      organizationId: workflow.organizationId,
      workflowId: workflow.id,
      customerId: "cust_otp_send",
    });

    const res = await ctx.request(
      `/workflows/workflow-sessions/${session.id}/email-otp/send`,
      {
        method: "POST",
        body: JSON.stringify({ email: "jana@example.com" }),
      },
    );
    expect(res.status).toBe(204);

    expect(ctx.mailer.verificationOtpCalls).toHaveLength(1);
    const call = ctx.mailer.verificationOtpCalls[0];
    expect(call.to).toBe("jana@example.com");
    expect(call.otp).toMatch(/^\d{6}$/);
  });

  test("send + verify with the recorded code completes the step", async () => {
    const { workflow } = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: workflow.workspaceId,
      organizationId: workflow.organizationId,
      workflowId: workflow.id,
      customerId: "cust_otp_verify",
    });

    await ctx.request(
      `/workflows/workflow-sessions/${session.id}/email-otp/send`,
      {
        method: "POST",
        body: JSON.stringify({ email: "anze@example.com" }),
      },
    );
    const { otp } = ctx.mailer.verificationOtpCalls[0]!;

    const verify = await ctx.request(
      `/workflows/workflow-sessions/${session.id}/email-otp/verify`,
      {
        method: "POST",
        body: JSON.stringify({ email: "anze@example.com", code: otp }),
      },
    );
    expect(verify.status).toBe(204);

    // The widget-facing completion attribute is what gates step-success.
    const attrs = await ctx.db.query.WorkflowSessionAttributeTable.findMany({
      where: (t, { eq }) => eq(t.workflowSessionId, session.id),
    });
    const emailAttr = attrs.find(
      (a) => a.attribute === "email_verification.email",
    );
    expect(emailAttr?.value).toBe("anze@example.com");
  });

  test("verify with a wrong code returns 400", async () => {
    const { workflow } = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: workflow.workspaceId,
      organizationId: workflow.organizationId,
      workflowId: workflow.id,
      customerId: "cust_wrong_code",
    });
    await ctx.request(
      `/workflows/workflow-sessions/${session.id}/email-otp/send`,
      {
        method: "POST",
        body: JSON.stringify({ email: "tine@example.com" }),
      },
    );

    const verify = await ctx.request(
      `/workflows/workflow-sessions/${session.id}/email-otp/verify`,
      {
        method: "POST",
        body: JSON.stringify({ email: "tine@example.com", code: "000000" }),
      },
    );
    expect(verify.status).toBe(400);
    const body = await verify.json();
    expect(body.code).toBe("code_mismatch");
  });

  test("a second send invalidates the first code", async () => {
    const { workflow } = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: workflow.workspaceId,
      organizationId: workflow.organizationId,
      workflowId: workflow.id,
      customerId: "cust_rotate",
    });
    await ctx.request(
      `/workflows/workflow-sessions/${session.id}/email-otp/send`,
      {
        method: "POST",
        body: JSON.stringify({ email: "luka@example.com" }),
      },
    );
    const firstOtp = ctx.mailer.verificationOtpCalls[0]!.otp;

    await ctx.request(
      `/workflows/workflow-sessions/${session.id}/email-otp/send`,
      {
        method: "POST",
        body: JSON.stringify({ email: "luka@example.com" }),
      },
    );
    const secondOtp = ctx.mailer.verificationOtpCalls[1]!.otp;
    // sanity: a fresh code was issued. The generator could collide in theory
    // but practically never with a 6-digit space + two consecutive calls.
    expect(secondOtp).not.toBe(firstOtp);

    // First code no longer works
    const oldAttempt = await ctx.request(
      `/workflows/workflow-sessions/${session.id}/email-otp/verify`,
      {
        method: "POST",
        body: JSON.stringify({ email: "luka@example.com", code: firstOtp }),
      },
    );
    expect(oldAttempt.status).toBe(400);

    // Second code does
    const goodAttempt = await ctx.request(
      `/workflows/workflow-sessions/${session.id}/email-otp/verify`,
      {
        method: "POST",
        body: JSON.stringify({ email: "luka@example.com", code: secondOtp }),
      },
    );
    expect(goodAttempt.status).toBe(204);
  });

  test("verify without sending first returns 400 (no_otp_pending)", async () => {
    const { workflow } = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: workflow.workspaceId,
      organizationId: workflow.organizationId,
      workflowId: workflow.id,
      customerId: "cust_no_pending",
    });
    const res = await ctx.request(
      `/workflows/workflow-sessions/${session.id}/email-otp/verify`,
      {
        method: "POST",
        body: JSON.stringify({ email: "x@example.com", code: "123456" }),
      },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("no_otp_pending");
  });

  test("verify against a different session id rejects (no_otp_pending)", async () => {
    const { workflow } = await seedDefaultTenant(ctx.db);
    const sessionA = await seedSession(ctx.db, {
      workspaceId: workflow.workspaceId,
      organizationId: workflow.organizationId,
      workflowId: workflow.id,
      customerId: "cust_a",
    });
    const sessionB = await seedSession(ctx.db, {
      workspaceId: workflow.workspaceId,
      organizationId: workflow.organizationId,
      workflowId: workflow.id,
      customerId: "cust_b",
    });
    await ctx.request(
      `/workflows/workflow-sessions/${sessionA.id}/email-otp/send`,
      {
        method: "POST",
        body: JSON.stringify({ email: "rok@example.com" }),
      },
    );
    const otpForA = ctx.mailer.verificationOtpCalls[0]!.otp;

    // Same code, different session — the OTP isn't pending on B.
    const cross = await ctx.request(
      `/workflows/workflow-sessions/${sessionB.id}/email-otp/verify`,
      {
        method: "POST",
        body: JSON.stringify({ email: "rok@example.com", code: otpForA }),
      },
    );
    expect(cross.status).toBe(400);
  });

  test("send for a non-existent session id returns 404 with session_not_found code", async () => {
    const res = await ctx.request(
      `/workflows/workflow-sessions/workflowsession_nope/email-otp/send`,
      {
        method: "POST",
        body: JSON.stringify({ email: "nobody@example.com" }),
      },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("session_not_found");
    expect(ctx.mailer.verificationOtpCalls).toHaveLength(0);
  });

  test("returns 409 when another customer in the workspace already verified the email", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    // Pre-existing customer who already has email_verification.email set.
    await seedVerifiedEmailSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_first_owner",
      email: "duplicate@example.com",
    });
    // New session for a DIFFERENT customer trying to claim the same email.
    const newSession = await seedSession(ctx.db, {
      workspaceId: tenant.workflow.workspaceId,
      organizationId: tenant.workflow.organizationId,
      workflowId: tenant.workflow.id,
      customerId: "cust_second_owner",
    });

    const res = await ctx.request(
      `/workflows/workflow-sessions/${newSession.id}/email-otp/send`,
      {
        method: "POST",
        body: JSON.stringify({ email: "duplicate@example.com" }),
      },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("email_already_used");
    expect(ctx.mailer.verificationOtpCalls).toHaveLength(0);
  });

  test("the duplicate-email guard is workspace-scoped (different workspace can reuse)", async () => {
    const tenantA = await seedDefaultTenant(ctx.db);
    const tenantB = await seedDefaultTenant(ctx.db);
    await seedVerifiedEmailSession(ctx.db, {
      workspaceId: tenantA.workflow.workspaceId,
      organizationId: tenantA.workflow.organizationId,
      workflowId: tenantA.workflow.id,
      customerId: "cust_a_owner",
      email: "shared@example.com",
    });
    const sessionInB = await seedSession(ctx.db, {
      workspaceId: tenantB.workflow.workspaceId,
      organizationId: tenantB.workflow.organizationId,
      workflowId: tenantB.workflow.id,
      customerId: "cust_b_owner",
    });

    const res = await ctx.request(
      `/workflows/workflow-sessions/${sessionInB.id}/email-otp/send`,
      {
        method: "POST",
        body: JSON.stringify({ email: "shared@example.com" }),
      },
    );
    expect(res.status).toBe(204);
    expect(ctx.mailer.verificationOtpCalls).toHaveLength(1);
  });

  test("forwards the locale to the mailer call", async () => {
    const { workflow } = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: workflow.workspaceId,
      organizationId: workflow.organizationId,
      workflowId: workflow.id,
      customerId: "cust_locale",
    });
    const res = await ctx.request(
      `/workflows/workflow-sessions/${session.id}/email-otp/send`,
      {
        method: "POST",
        body: JSON.stringify({ email: "polona@example.com", locale: "sl" }),
      },
    );
    expect(res.status).toBe(204);
    expect(ctx.mailer.verificationOtpCalls[0]!.locale).toBe("sl");
  });
});
