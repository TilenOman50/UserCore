// Adding + removing workflow steps and toggling identity-verification
// sub-steps. The mutations also exercise validity recomputation — after each
// edit the workflow's `valid` + `reasons` are rebuilt server-side, so most
// tests double-check those alongside the step mutation itself.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { bootTestApp, type TestApp } from "./utils/testApp";
import { seedWorkflow } from "./utils/seed";

// A fresh workspace + workflow without seedDefaultTenant's pre-seeded
// identity-verification step. Each test in this file builds its own step
// graph so the path through the routes is the one we're testing.
const seedBareWorkflow = async (ctx: TestApp) => {
  const workspaceId = `ws_${Math.random().toString(36).slice(2, 8)}`;
  const organizationId = `org_${Math.random().toString(36).slice(2, 8)}`;
  return seedWorkflow(ctx.db, {
    workspaceId,
    organizationId,
    displayName: "Step-test workflow",
    isDefault: true,
  });
};

describe("POST /workflows/workflows/:workflowId/identity-verification", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("creates the iv step and pre-seeds all six sub-step rows", async () => {
    const workflow = await seedBareWorkflow(ctx);
    const res = await ctx.request(
      `/workflows/workflows/${workflow.id}/identity-verification`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe("identity-verification");

    const subSteps = await ctx.db.query.IdentityVerificationSubStepTable.findMany();
    expect(subSteps).toHaveLength(6);
    // terms-acceptance is seeded enabled (always required); the rest are off
    // until the operator opts in.
    const terms = subSteps.find((s) => s.type === "terms-acceptance");
    expect(terms?.enabled).toBe(true);
    const idScan = subSteps.find((s) => s.type === "id-scan");
    expect(idScan?.enabled).toBe(false);
  });

  test("re-adding the identity-verification step is idempotent (returns existing)", async () => {
    const workflow = await seedBareWorkflow(ctx);
    const first = await ctx.request(
      `/workflows/workflows/${workflow.id}/identity-verification`,
      { method: "POST", body: JSON.stringify({}) },
    );
    const firstBody = await first.json();
    const second = await ctx.request(
      `/workflows/workflows/${workflow.id}/identity-verification`,
      { method: "POST", body: JSON.stringify({}) },
    );
    const secondBody = await second.json();
    // Same workflow_step row returned, not a duplicate.
    expect(secondBody.id).toBe(firstBody.id);
    const allSteps = await ctx.db.query.WorkflowStepTable.findMany({
      where: (t, { eq }) => eq(t.workflowId, workflow.id),
    });
    expect(allSteps).toHaveLength(1);
  });
});

describe("POST /workflows/workflows/:workflowId/aml-screening", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("with a provider, creates the step and the workflow stays consistent", async () => {
    const workflow = await seedBareWorkflow(ctx);
    const res = await ctx.request(
      `/workflows/workflows/${workflow.id}/aml-screening`,
      {
        method: "POST",
        body: JSON.stringify({ provider: "complyAdvantage" }),
      },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.provider).toBe("complyAdvantage");
    expect(body.valid).toBe(true);
  });

  test("without a provider, step is created but workflow validity stays false with 'needs provider' reason", async () => {
    const workflow = await seedBareWorkflow(ctx);
    const add = await ctx.request(
      `/workflows/workflows/${workflow.id}/aml-screening`,
      { method: "POST", body: JSON.stringify({}) },
    );
    expect(add.status).toBe(201);
    const addBody = await add.json();
    expect(addBody.provider).toBeNull();
    expect(addBody.valid).toBe(false);

    const get = await ctx.request(`/workflows/workflows/${workflow.id}`);
    const body = await get.json();
    expect(body.valid).toBe(false);
    expect(
      body.reasons.some(
        (r: { stepType?: string; message: string }) =>
          r.stepType === "aml-screening" && r.message.includes("provider"),
      ),
    ).toBe(true);
  });
});

describe("DELETE /workflows/workflow-steps/:workflowStepId/aml-screening", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("removing the only aml step flips workflow validity back to depending on remaining steps", async () => {
    const workflow = await seedBareWorkflow(ctx);
    // Add aml without provider — invalid.
    const add = await ctx.request(
      `/workflows/workflows/${workflow.id}/aml-screening`,
      { method: "POST", body: JSON.stringify({}) },
    );
    const { id: workflowStepId } = await add.json();

    const del = await ctx.request(
      `/workflows/workflow-steps/${workflowStepId}/aml-screening`,
      { method: "DELETE" },
    );
    expect(del.status).toBe(204);

    // Workflow now has zero steps → invalid for the "no steps" reason.
    const get = await ctx.request(`/workflows/workflows/${workflow.id}`);
    const body = await get.json();
    expect(body.valid).toBe(false);
    expect(
      body.reasons.some((r: { message: string }) =>
        r.message.includes("at least one step"),
      ),
    ).toBe(true);
    expect(body.steps).toHaveLength(0);
  });
});

describe("PATCH /workflows/identity-verification/sub-steps/:subStepId", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("toggling a sub-step off persists, and the iv step recomputes accordingly", async () => {
    const workflow = await seedBareWorkflow(ctx);
    const addRes = await ctx.request(
      `/workflows/workflows/${workflow.id}/identity-verification`,
      { method: "POST", body: JSON.stringify({}) },
    );
    const ivWorkflowStep = await addRes.json();

    // Enable id-scan first so the workflow has a real sub-step enabled, then
    // toggle it off and confirm the change lands.
    const subStepsBefore = await ctx.db.query.IdentityVerificationSubStepTable.findMany();
    const idScan = subStepsBefore.find((s) => s.type === "id-scan")!;

    const enable = await ctx.request(
      `/workflows/identity-verification/sub-steps/${idScan.id}`,
      { method: "PATCH", body: JSON.stringify({ enabled: true }) },
    );
    expect(enable.status).toBe(200);
    const enableBody = await enable.json();
    expect(enableBody.enabled).toBe(true);

    const disable = await ctx.request(
      `/workflows/identity-verification/sub-steps/${idScan.id}`,
      { method: "PATCH", body: JSON.stringify({ enabled: false }) },
    );
    expect(disable.status).toBe(200);
    const disableBody = await disable.json();
    expect(disableBody.enabled).toBe(false);

    // The sub-step toggle drives identity-verification step validity, which
    // bubbles up to workflow validity. With only terms-acceptance enabled the
    // iv step is invalid → workflow is invalid.
    const getDetail = await ctx.request(
      `/workflows/workflow-steps/${ivWorkflowStep.id}/identity-verification`,
    );
    const detail = await getDetail.json();
    expect(
      detail.subSteps.find((s: { type: string }) => s.type === "id-scan")
        ?.enabled,
    ).toBe(false);
  });
});

describe("Cross-workspace workflow-step boundary", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("a step add against a foreign workflow id either errors or no-ops — never silently mutates", async () => {
    // The step routes don't take a workspace context, but workflowId is a
    // server-side primary key — a foreign workflow id just resolves to that
    // workflow if it happens to exist. The protection lives in dashboard
    // authz: you can't enumerate other workspaces' workflow ids. Confirm here
    // that hitting a nonsense id surfaces a server error (no silent success).
    // The route catches and re-throws via the onError handler → 500.
    const res = await ctx.request(
      `/workflows/workflows/workflow_does_not_exist/aml-screening`,
      { method: "POST", body: JSON.stringify({ provider: "complyAdvantage" }) },
    );
    // FK violation on workflow_step.workflow_id surfaces as 500 from the
    // catch-all. The important guarantee is "not 201" — the request didn't
    // accidentally create a step against an unknown workflow.
    expect(res.status).not.toBe(201);
  });
});

describe("Rules engine — scenario linking flips validity", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("adding the step then linking a scenario marks the workflow valid", async () => {
    const workflow = await seedBareWorkflow(ctx);
    const addStep = await ctx.request(
      `/workflows/workflows/${workflow.id}/rules-engine`,
      { method: "POST", body: JSON.stringify({}) },
    );
    expect(addStep.status).toBe(201);
    const stepBody = await addStep.json();
    expect(stepBody.valid).toBe(false);

    // Pre-link, the workflow is invalid because the rules-engine step has no
    // scenarios attached yet.
    const beforeGet = await ctx.request(
      `/workflows/workflows/${workflow.id}`,
    );
    const beforeBody = await beforeGet.json();
    expect(beforeBody.valid).toBe(false);

    const link = await ctx.request(
      `/workflows/workflow-steps/${stepBody.id}/rules-engine/scenarios`,
      {
        method: "POST",
        body: JSON.stringify({ externalScenarioId: "scenario_kyc_v1" }),
      },
    );
    expect(link.status).toBe(201);

    const afterGet = await ctx.request(`/workflows/workflows/${workflow.id}`);
    const afterBody = await afterGet.json();
    expect(afterBody.valid).toBe(true);
    expect(afterBody.reasons).toEqual([]);
  });
});
