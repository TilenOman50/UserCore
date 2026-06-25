// Public read-side endpoints for verified-customer data — the surface
// documented in the in-app Documentation page. Tests cover authentication,
// workspace isolation, the snapshot shape, and the fallback chain for
// country (resident → document country → null).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { bootTestApp, type TestApp } from "./utils/testApp";
import {
  seedDefaultTenant,
  seedSession,
  seedSessionAttribute,
  seedSessionStep,
} from "./utils/seed";

describe("GET /workflows/customers/:customerId", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("returns the customer snapshot for a verified customer", async () => {
    const { workflow, apiKey } = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: workflow.workspaceId,
      organizationId: workflow.organizationId,
      workflowId: workflow.id,
      customerId: "cust_abc",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "SUCCEEDED",
    });
    await seedSessionAttribute(ctx.db, {
      sessionId: session.id,
      attribute: "email_verification.email",
      value: "anja@example.com",
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

    const res = await ctx.request("/workflows/customers/cust_abc", {
      apiKey: apiKey.secret,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      customerId: "cust_abc",
      email: "anja@example.com",
      firstName: "Anja",
      lastName: "Novak",
      country: "SVN",
      status: "SUCCEEDED",
      lastVerifiedAt: expect.any(String),
    });
  });

  test("falls back to document country when residence country is missing", async () => {
    const { workflow, apiKey } = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: workflow.workspaceId,
      organizationId: workflow.organizationId,
      workflowId: workflow.id,
      customerId: "cust_doc_only",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
    });
    await seedSessionAttribute(ctx.db, {
      sessionId: session.id,
      attribute: "identity_verification.document_country",
      value: "DEU",
    });

    const res = await ctx.request("/workflows/customers/cust_doc_only", {
      apiKey: apiKey.secret,
    });
    const body = await res.json();
    expect(body.country).toBe("DEU");
    expect(body.status).toBe("REQUIRES_REVIEW");
  });

  test("returns 404 for a customer that doesn't exist", async () => {
    const { apiKey } = await seedDefaultTenant(ctx.db);
    const res = await ctx.request("/workflows/customers/cust_nope", {
      apiKey: apiKey.secret,
    });
    expect(res.status).toBe(404);
  });

  test("returns 404 (not 200) when the customer lives in a different workspace", async () => {
    // Seed two tenants, then look up customer-A's id with workspace-B's key.
    const tenantA = await seedDefaultTenant(ctx.db);
    const tenantB = await seedDefaultTenant(ctx.db);
    const sessionA = await seedSession(ctx.db, {
      workspaceId: tenantA.workflow.workspaceId,
      organizationId: tenantA.workflow.organizationId,
      workflowId: tenantA.workflow.id,
      customerId: "cust_leak_check",
    });
    await seedSessionStep(ctx.db, {
      sessionId: sessionA.id,
      step: "identity-verification",
      status: "SUCCEEDED",
    });

    const res = await ctx.request("/workflows/customers/cust_leak_check", {
      apiKey: tenantB.apiKey.secret,
    });
    expect(res.status).toBe(404);
  });

  test("401 without an Authorization header", async () => {
    const res = await ctx.request("/workflows/customers/cust_anything");
    expect(res.status).toBe(401);
  });

  test("401 with an invalid bearer token", async () => {
    const res = await ctx.request("/workflows/customers/cust_anything", {
      apiKey: "uc_invalid_key_xxxxxxxxxxxxxxxxxxxx",
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /workflows/customers/by-email", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("resolves a customer by their verified email", async () => {
    const { workflow, apiKey } = await seedDefaultTenant(ctx.db);
    const session = await seedSession(ctx.db, {
      workspaceId: workflow.workspaceId,
      organizationId: workflow.organizationId,
      workflowId: workflow.id,
      customerId: "cust_otp_login",
    });
    await seedSessionStep(ctx.db, {
      sessionId: session.id,
      step: "identity-verification",
      status: "SUCCEEDED",
    });
    await seedSessionAttribute(ctx.db, {
      sessionId: session.id,
      attribute: "email_verification.email",
      value: "marko@example.com",
    });

    const res = await ctx.request(
      "/workflows/customers/by-email?email=marko%40example.com",
      { apiKey: apiKey.secret },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.customerId).toBe("cust_otp_login");
    expect(body.email).toBe("marko@example.com");
  });

  test("returns 404 for an unknown email", async () => {
    const { apiKey } = await seedDefaultTenant(ctx.db);
    const res = await ctx.request(
      "/workflows/customers/by-email?email=ghost%40example.com",
      { apiKey: apiKey.secret },
    );
    expect(res.status).toBe(404);
  });

  test("workspace-isolated — workspace B can't see workspace A's emails", async () => {
    const tenantA = await seedDefaultTenant(ctx.db);
    const tenantB = await seedDefaultTenant(ctx.db);
    const sessionA = await seedSession(ctx.db, {
      workspaceId: tenantA.workflow.workspaceId,
      organizationId: tenantA.workflow.organizationId,
      workflowId: tenantA.workflow.id,
      customerId: "cust_in_a",
    });
    await seedSessionAttribute(ctx.db, {
      sessionId: sessionA.id,
      attribute: "email_verification.email",
      value: "leaked@example.com",
    });

    const res = await ctx.request(
      "/workflows/customers/by-email?email=leaked%40example.com",
      { apiKey: tenantB.apiKey.secret },
    );
    expect(res.status).toBe(404);
  });
});
