// Workflow CRUD + default-promotion semantics + branding upload. The workflows
// router doesn't use API-key auth (the dashboard speaks to it directly), so
// these tests skip the `apiKey:` header. Soft-delete is exercised directly
// against the DB because the list endpoint already hides deleted rows.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { bootTestApp, type TestApp } from "./utils/testApp";
import { seedDefaultTenant, seedWorkflow } from "./utils/seed";

describe("POST /workflows/workflows", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("creates a workflow with valid=false and empty reasons (no steps yet)", async () => {
    const res = await ctx.request("/workflows/workflows", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: "ws_create",
        organizationId: "org_create",
        displayName: "First workflow",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.displayName).toBe("First workflow");
    expect(body.valid).toBe(false);
    // create() doesn't run recomputeValidity, so reasons stays at the DB
    // default ([]). The dashboard's "needs configuration" banner reads the
    // step list itself when reasons is empty + valid is false.
    expect(body.reasons).toEqual([]);
  });
});

describe("GET /workflows/workflows/:id", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("returns the workflow with its steps", async () => {
    const { workflow } = await seedDefaultTenant(ctx.db);
    const res = await ctx.request(`/workflows/workflows/${workflow.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(workflow.id);
    expect(Array.isArray(body.steps)).toBe(true);
    // seedDefaultTenant seeds the identity-verification step.
    expect(
      body.steps.some(
        (s: { type: string }) => s.type === "identity-verification",
      ),
    ).toBe(true);
  });

  test("returns 404 for a non-existent workflow id", async () => {
    const res = await ctx.request("/workflows/workflows/workflow_nope");
    expect(res.status).toBe(404);
  });
});

describe("GET /workflows/workflows/workspace/:workspaceId", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("lists only the requested workspace's workflows", async () => {
    const tenantA = await seedDefaultTenant(ctx.db);
    const tenantB = await seedDefaultTenant(ctx.db);
    const res = await ctx.request(
      `/workflows/workflows/workspace/${tenantA.workspaceId}?organizationId=${tenantA.organizationId}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(tenantA.workflow.id);
    expect(body.some((w: { id: string }) => w.id === tenantB.workflow.id)).toBe(
      false,
    );
  });
});

describe("PATCH /workflows/workflows/:id", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("renames a workflow (displayName)", async () => {
    const { workflow } = await seedDefaultTenant(ctx.db);
    const res = await ctx.request(`/workflows/workflows/${workflow.id}`, {
      method: "PATCH",
      body: JSON.stringify({ displayName: "Renamed flow" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.displayName).toBe("Renamed flow");
  });

  test("promoting one workflow to default demotes the prior default", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    // Seed a second workflow in the same workspace, currently NOT default.
    const second = await seedWorkflow(ctx.db, {
      workspaceId: tenant.workspaceId,
      organizationId: tenant.organizationId,
      displayName: "Challenger",
      isDefault: false,
    });

    const res = await ctx.request(`/workflows/workflows/${second.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isDefault: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isDefault).toBe(true);

    // Prior default should now be demoted.
    const prior = await ctx.db.query.WorkflowTable.findFirst({
      where: (t, { eq }) => eq(t.id, tenant.workflow.id),
    });
    expect(prior?.isDefault).toBe(false);
  });

  test("promoting to default when no default exists succeeds without conflict", async () => {
    // Workspace with a single non-default workflow.
    const workflow = await seedWorkflow(ctx.db, {
      workspaceId: "ws_lonely",
      organizationId: "org_lonely",
      isDefault: false,
    });
    const res = await ctx.request(`/workflows/workflows/${workflow.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isDefault: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isDefault).toBe(true);
  });
});

describe("DELETE /workflows/workflows/:id", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("soft-deletes the workflow (deletedAt set, hidden from list)", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const res = await ctx.request(
      `/workflows/workflows/${tenant.workflow.id}`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(204);

    // Hidden from the list endpoint.
    const list = await ctx.request(
      `/workflows/workflows/workspace/${tenant.workspaceId}?organizationId=${tenant.organizationId}`,
    );
    const items = await list.json();
    expect(items.find((w: { id: string }) => w.id === tenant.workflow.id)).toBeUndefined();

    // Still resolves directly from the DB (compliance retention).
    const raw = await ctx.db.query.WorkflowTable.findFirst({
      where: (t, { eq }) => eq(t.id, tenant.workflow.id),
    });
    expect(raw?.deletedAt).not.toBeNull();
  });

  test("DELETE on a default workflow currently still soft-deletes it", async () => {
    // No explicit safeguard in workflowsService.deleteWorkflow today, so this
    // test pins the actual behaviour: default + soft-delete is allowed and the
    // workspace ends up with no default. (If we add a guard later, flip this
    // expectation.)
    const tenant = await seedDefaultTenant(ctx.db);
    const res = await ctx.request(
      `/workflows/workflows/${tenant.workflow.id}`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(204);
    const list = await ctx.request(
      `/workflows/workflows/workspace/${tenant.workspaceId}?organizationId=${tenant.organizationId}`,
    );
    const items = await list.json();
    expect(items).toHaveLength(0);
  });
});

describe("Cross-workspace workflow visibility", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("workspace B's listing endpoint never returns workspace A's workflows", async () => {
    const tenantA = await seedDefaultTenant(ctx.db);
    const tenantB = await seedDefaultTenant(ctx.db);
    const res = await ctx.request(
      `/workflows/workflows/workspace/${tenantB.workspaceId}?organizationId=${tenantB.organizationId}`,
    );
    expect(res.status).toBe(200);
    const items = await res.json();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(tenantB.workflow.id);
    expect(items.some((w: { id: string }) => w.id === tenantA.workflow.id)).toBe(
      false,
    );
  });
});

describe("Workflow validity recomputation via step changes", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("identity-verification step with no enabled sub-steps marks the workflow invalid", async () => {
    // Add the iv step from scratch on a bare workflow so the addStep service
    // path runs end-to-end (creates the sub-step rows + recomputes validity).
    // seedDefaultTenant pre-inserts the workflow_step row directly, so a POST
    // to identity-verification would be the idempotent no-op branch and never
    // recompute reasons — bypass that by skipping seedDefaultTenant here.
    const workflow = await seedWorkflow(ctx.db, {
      workspaceId: "ws_recompute",
      organizationId: "org_recompute",
    });
    await ctx.request(
      `/workflows/workflows/${workflow.id}/identity-verification`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
    const res = await ctx.request(`/workflows/workflows/${workflow.id}`);
    const body = await res.json();
    expect(body.valid).toBe(false);
    // Identity-verification reason — no sub-steps enabled.
    expect(
      body.reasons.some((r: { stepType?: string; message: string }) =>
        r.message.includes("sub-steps"),
      ),
    ).toBe(true);
  });

  test("aml-screening step without a provider flips workflow invalid with provider reason", async () => {
    const tenant = await seedDefaultTenant(ctx.db);
    const add = await ctx.request(
      `/workflows/workflows/${tenant.workflow.id}/aml-screening`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
    expect(add.status).toBe(201);

    const res = await ctx.request(`/workflows/workflows/${tenant.workflow.id}`);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(
      body.reasons.some((r: { stepType?: string; message: string }) =>
        r.stepType === "aml-screening" && r.message.includes("provider"),
      ),
    ).toBe(true);
  });
});

describe("Branding logo upload", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("POST /workflows/:id/branding/logo stores the key and persists it on branding", async () => {
    const { workflow } = await seedDefaultTenant(ctx.db);
    const form = new FormData();
    form.set("file", new File([new Uint8Array([1, 2, 3, 4])], "logo.png", {
      type: "image/png",
    }));
    const res = await ctx.app.fetch(
      new Request(
        `http://localhost/workflows/workflows/${workflow.id}/branding/logo`,
        { method: "POST", body: form },
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branding.logoS3Key).toBeDefined();
    // FakeStorage recorded the upload key.
    expect(ctx.storage.uploadedKeys).toHaveLength(1);
    expect(ctx.storage.uploadedKeys[0]).toMatch(/^branding\//);
  });
});
