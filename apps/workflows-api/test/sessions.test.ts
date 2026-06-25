// POST /workflows/workflow-sessions — the public session-create endpoint.
// Tests cover auth, workflow resolution (explicit + default), plan-limit
// enforcement, and the response shape.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { bootTestApp, type TestApp } from "./utils/testApp";
import { seedApiKey, seedDefaultTenant, seedWorkflow } from "./utils/seed";

describe("POST /workflows/workflow-sessions", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("creates a session against an explicitly-specified workflow", async () => {
    const { workflow, apiKey } = await seedDefaultTenant(ctx.db);
    const res = await ctx.request("/workflows/workflow-sessions", {
      method: "POST",
      apiKey: apiKey.secret,
      body: JSON.stringify({
        externalSessionId: "ext_session_1",
        externalSessionSource: "widget",
        customerId: "cust_signup_1",
        workflowId: workflow.id,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.customerId).toBe("cust_signup_1");
    expect(body.workflowId).toBe(workflow.id);
    expect(body.externalSessionSource).toBe("widget");
    expect(body.verificationMode).toBe("sandbox");
  });

  test("resolves the workspace's default workflow when none is specified", async () => {
    // seedDefaultTenant flags the workflow as default
    const { workflow, apiKey } = await seedDefaultTenant(ctx.db);
    const res = await ctx.request("/workflows/workflow-sessions", {
      method: "POST",
      apiKey: apiKey.secret,
      body: JSON.stringify({
        externalSessionId: "ext_session_default",
        externalSessionSource: "widget",
        customerId: "cust_no_workflow_id",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.workflowId).toBe(workflow.id);
  });

  test("returns 400 when workflowId is omitted AND the workspace has no default", async () => {
    // Seed a tenant but DON'T mark the workflow as default
    const workspaceId = "ws_nodefault";
    const organizationId = "org_nodefault";
    await seedWorkflow(ctx.db, {
      workspaceId,
      organizationId,
      isDefault: false,
    });
    const apiKey = await seedApiKey(ctx.db, { workspaceId, organizationId });
    const res = await ctx.request("/workflows/workflow-sessions", {
      method: "POST",
      apiKey: apiKey.secret,
      body: JSON.stringify({
        externalSessionId: "ext_no_default",
        externalSessionSource: "widget",
        customerId: "cust_no_default",
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/default workflow/i);
  });

  test("returns 401 when no Authorization header is set (widget source)", async () => {
    const { workflow } = await seedDefaultTenant(ctx.db);
    const res = await ctx.request("/workflows/workflow-sessions", {
      method: "POST",
      body: JSON.stringify({
        externalSessionId: "ext_no_auth",
        externalSessionSource: "widget",
        customerId: "cust_no_auth",
        workflowId: workflow.id,
      }),
    });
    expect(res.status).toBe(401);
  });

  test("returns 401 when API key is invalid", async () => {
    const { workflow } = await seedDefaultTenant(ctx.db);
    const res = await ctx.request("/workflows/workflow-sessions", {
      method: "POST",
      apiKey: "uc_fakeKeyDoesNotResolveToAnything",
      body: JSON.stringify({
        externalSessionId: "ext_bad_key",
        externalSessionSource: "widget",
        customerId: "cust_bad_key",
        workflowId: workflow.id,
      }),
    });
    expect(res.status).toBe(401);
  });

  test("returns 403 with plan_limit_exceeded when STARTER quota is exhausted", async () => {
    const { workflow, apiKey } = await seedDefaultTenant(ctx.db);
    // STARTER plan: 100 verifications/month. Tests pretend we're at the cap.
    // We override the planStub to STARTER + simulate having hit the ceiling.
    ctx.setPlan({ plan: "STARTER" });

    // Create 100 sessions to fill the quota
    const promises = Array.from({ length: 100 }, (_, i) =>
      ctx.request("/workflows/workflow-sessions", {
        method: "POST",
        apiKey: apiKey.secret,
        body: JSON.stringify({
          externalSessionId: `ext_quota_${i}`,
          externalSessionSource: "widget",
          customerId: `cust_quota_${i}`,
          workflowId: workflow.id,
        }),
      }),
    );
    await Promise.all(promises);

    // 101st should hit the plan limit
    const overflow = await ctx.request("/workflows/workflow-sessions", {
      method: "POST",
      apiKey: apiKey.secret,
      body: JSON.stringify({
        externalSessionId: "ext_quota_overflow",
        externalSessionSource: "widget",
        customerId: "cust_quota_overflow",
        workflowId: workflow.id,
      }),
    });
    expect(overflow.status).toBe(403);
    const body = await overflow.json();
    expect(body.code).toBe("plan_limit_exceeded");
    expect(body.max).toBe(100);
  });
});

describe("GET /workflows/workflow-sessions/:id", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("returns full session detail (steps + attributes + events)", async () => {
    const { workflow, apiKey } = await seedDefaultTenant(ctx.db);
    // Create a session via the public route so we get the same lifecycle
    const create = await ctx.request("/workflows/workflow-sessions", {
      method: "POST",
      apiKey: apiKey.secret,
      body: JSON.stringify({
        externalSessionId: "ext_detail_test",
        externalSessionSource: "widget",
        customerId: "cust_detail_test",
        workflowId: workflow.id,
      }),
    });
    const { id: sessionId } = await create.json();

    const res = await ctx.request(`/workflows/workflow-sessions/${sessionId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session.id).toBe(sessionId);
    expect(body.session.customerId).toBe("cust_detail_test");
    expect(Array.isArray(body.steps)).toBe(true);
    expect(Array.isArray(body.attributes)).toBe(true);
    expect(Array.isArray(body.events)).toBe(true);
  });

  test("returns 404 for a non-existent session id", async () => {
    const res = await ctx.request("/workflows/workflow-sessions/wkfsession_nope");
    expect(res.status).toBe(404);
  });
});
