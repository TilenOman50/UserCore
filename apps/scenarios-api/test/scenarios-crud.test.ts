// Scenario CRUD through the HTTP surface. The dashboard is the only
// consumer; routes are unauthenticated (workspace scoping is the boundary).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { emptyEvaluation } from "@usercore/shared-types";

import { ScenarioTable } from "../src/db/schema.db";
import { bootTestApp, type TestApp } from "./utils/testApp";

const seedScenario = async (
  ctx: TestApp,
  overrides: Partial<typeof ScenarioTable.$inferInsert> = {},
) => {
  const [row] = await ctx.db
    .insert(ScenarioTable)
    .values({
      workspaceId: "ws_main",
      name: "Seeded scenario",
      evaluation: emptyEvaluation(),
      actions: [],
      ...overrides,
    })
    .returning();
  return row;
};

describe("POST /scenarios", () => {
  let ctx: TestApp;
  beforeEach(async () => {
    ctx = await bootTestApp();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  test("creates a scenario with an empty evaluation tree and no actions", async () => {
    const res = await ctx.request("/scenarios", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: "ws_main",
        name: "High-risk PEPs",
        description: "Auto-flag any PEP hit",
        createdBy: "member_alice",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("High-risk PEPs");
    expect(body.workspaceId).toBe("ws_main");
    expect(body.createdBy).toBe("member_alice");
    expect(body.evaluation).toEqual({
      operator: "AND",
      queries: [],
      queryGroups: [],
    });
    expect(body.actions).toEqual([]);

    const rows = await ctx.db.select().from(ScenarioTable);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(body.id);
  });

  test("rejects a name longer than 120 characters", async () => {
    const res = await ctx.request("/scenarios", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: "ws_main",
        name: "x".repeat(121),
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /scenarios/workspace/:workspaceId", () => {
  let ctx: TestApp;
  beforeEach(async () => {
    ctx = await bootTestApp();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  test("lists only scenarios that belong to the given workspace", async () => {
    await seedScenario(ctx, { workspaceId: "ws_a", name: "A1" });
    await seedScenario(ctx, { workspaceId: "ws_a", name: "A2" });
    await seedScenario(ctx, { workspaceId: "ws_b", name: "B1" });

    const res = await ctx.request("/scenarios/workspace/ws_a");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; workspaceId: string }[];
    expect(body).toHaveLength(2);
    expect(body.every((s) => s.workspaceId === "ws_a")).toBe(true);
    expect(body.map((s) => s.name).sort()).toEqual(["A1", "A2"]);
  });

  test("returns an empty array when the workspace has no scenarios", async () => {
    const res = await ctx.request("/scenarios/workspace/ws_empty");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe("GET /scenarios/:id", () => {
  let ctx: TestApp;
  beforeEach(async () => {
    ctx = await bootTestApp();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  test("returns 404 for an unknown scenario id", async () => {
    const res = await ctx.request("/scenarios/scenario_ghost");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Scenario not found" });
  });

  test("returns the scenario with its evaluation tree and actions", async () => {
    const seeded = await seedScenario(ctx, {
      name: "Under-18 block",
      evaluation: {
        operator: "AND",
        queries: [
          {
            attribute: "identity_verification.age",
            operator: "lt",
            value: "18",
          },
        ],
        queryGroups: [],
      },
      actions: [
        { type: "set_customer_status", value: "rejected", enabled: true },
      ],
    });
    const res = await ctx.request(`/scenarios/${seeded.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(seeded.id);
    expect(body.name).toBe("Under-18 block");
    expect(body.evaluation.queries[0].attribute).toBe(
      "identity_verification.age",
    );
    expect(body.actions[0].value).toBe("rejected");
  });
});

describe("PATCH /scenarios/:id", () => {
  let ctx: TestApp;
  beforeEach(async () => {
    ctx = await bootTestApp();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  test("updates name, evaluation tree, and actions in a single call", async () => {
    const seeded = await seedScenario(ctx, { name: "Draft" });
    const res = await ctx.request(`/scenarios/${seeded.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: "Sanctioned countries",
        evaluation: {
          operator: "OR",
          queries: [
            {
              attribute: "identity_verification.nationality",
              operator: "in",
              value: "IRN,PRK,RUS",
            },
          ],
          queryGroups: [],
        },
        actions: [
          { type: "set_customer_risk_level", value: "high", enabled: true },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Sanctioned countries");
    expect(body.evaluation.operator).toBe("OR");
    expect(body.actions[0].type).toBe("set_customer_risk_level");

    const reread = await ctx.db
      .select()
      .from(ScenarioTable)
      .where(eq(ScenarioTable.id, seeded.id));
    expect(reread[0].name).toBe("Sanctioned countries");
    expect(reread[0].actions[0].value).toBe("high");
  });
});

describe("DELETE /scenarios/:id", () => {
  let ctx: TestApp;
  beforeEach(async () => {
    ctx = await bootTestApp();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  test("removes the row and subsequent GET returns 404", async () => {
    const seeded = await seedScenario(ctx);
    const del = await ctx.request(`/scenarios/${seeded.id}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(204);

    const get = await ctx.request(`/scenarios/${seeded.id}`);
    expect(get.status).toBe(404);

    const rows = await ctx.db.select().from(ScenarioTable);
    expect(rows).toHaveLength(0);
  });
});
