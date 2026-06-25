// /scenarios/evaluate is the hot path: the rules-engine workflow step calls
// it with a flattened attribute map and expects back the triggered scenarios
// + actions. Each enabled action of a triggered scenario also fans out a
// SCENARIO_TRIGGERED event on the bus.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { emptyEvaluation, EVENTS } from "@usercore/shared-types";

import { ScenarioTable } from "../src/db/schema.db";
import { bootTestApp, type TestApp } from "./utils/testApp";

const evaluate = (ctx: TestApp, body: Record<string, unknown>) =>
  ctx.request("/scenarios/evaluate", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("POST /scenarios/evaluate", () => {
  let ctx: TestApp;
  beforeEach(async () => {
    ctx = await bootTestApp();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  test("flags an under-18 customer via the age derived attribute", async () => {
    await ctx.db.insert(ScenarioTable).values({
      workspaceId: "ws_main",
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

    const res = await evaluate(ctx, {
      workspaceId: "ws_main",
      customerId: "cust_teen",
      customerData: {
        "identity_verification.date_of_birth": "2015-01-01",
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.evaluated).toBe(true);
    expect(body.triggered).toHaveLength(1);
    expect(body.triggered[0].name).toBe("Under-18 block");
    expect(body.triggered[0].actions[0].value).toBe("rejected");
    expect(body.evaluations[0].matched).toBe(true);
    expect(body.evaluations[0].conditions[0].passed).toBe(true);

    expect(ctx.rabbit.published).toHaveLength(1);
    expect(ctx.rabbit.published[0].routingKey).toBe(EVENTS.SCENARIO_TRIGGERED);
    expect(ctx.rabbit.published[0].payload).toMatchObject({
      customerId: "cust_teen",
      workspaceId: "ws_main",
      actionType: "set_customer_status",
      actionValue: "rejected",
    });
  });

  test("does not trigger when the customer is over the age threshold", async () => {
    await ctx.db.insert(ScenarioTable).values({
      workspaceId: "ws_main",
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

    const res = await evaluate(ctx, {
      workspaceId: "ws_main",
      customerId: "cust_adult",
      customerData: {
        "identity_verification.date_of_birth": "1990-01-01",
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.triggered).toEqual([]);
    expect(body.evaluations[0].matched).toBe(false);
    expect(ctx.rabbit.published).toHaveLength(0);
  });

  test("normalizes alpha-2 nationality codes to alpha-3 for country attributes", async () => {
    await ctx.db.insert(ScenarioTable).values({
      workspaceId: "ws_main",
      name: "Sanctioned countries",
      // Rule stored as alpha-3 — the customer attribute arrives as alpha-2.
      evaluation: {
        operator: "AND",
        queries: [
          {
            attribute: "identity_verification.document_nationality",
            operator: "in",
            value: "IRN,PRK,RUS",
          },
        ],
        queryGroups: [],
      },
      actions: [
        { type: "set_customer_risk_level", value: "high", enabled: true },
      ],
    });

    const res = await evaluate(ctx, {
      workspaceId: "ws_main",
      customerId: "cust_ru",
      customerData: { "identity_verification.document_nationality": "RU" },
    });
    const body = await res.json();
    expect(body.triggered).toHaveLength(1);
    expect(body.triggered[0].actions[0].value).toBe("high");
  });

  test("scenarioIds filter limits evaluation to the linked scenarios only", async () => {
    const [a, b] = await ctx.db
      .insert(ScenarioTable)
      .values([
        {
          workspaceId: "ws_main",
          name: "Always match A",
          evaluation: {
            operator: "AND",
            queries: [
              { attribute: "flag.a", operator: "eq", value: "yes" },
            ],
            queryGroups: [],
          },
          actions: [
            { type: "assign_tag", value: "tag_a", enabled: true },
          ],
        },
        {
          workspaceId: "ws_main",
          name: "Always match B",
          evaluation: {
            operator: "AND",
            queries: [
              { attribute: "flag.b", operator: "eq", value: "yes" },
            ],
            queryGroups: [],
          },
          actions: [
            { type: "assign_tag", value: "tag_b", enabled: true },
          ],
        },
      ])
      .returning();

    const res = await evaluate(ctx, {
      workspaceId: "ws_main",
      customerId: "cust_filter",
      customerData: { "flag.a": "yes", "flag.b": "yes" },
      scenarioIds: [a.id],
    });
    const body = await res.json();
    expect(body.evaluations).toHaveLength(1);
    expect(body.evaluations[0].scenarioId).toBe(a.id);
    expect(body.triggered).toHaveLength(1);
    expect(body.triggered[0].scenarioId).toBe(a.id);
    // Sibling scenario b should be untouched.
    expect(body.triggered.find((t: { scenarioId: string }) => t.scenarioId === b.id)).toBeUndefined();
  });

  test("scenarios from another workspace are never evaluated", async () => {
    await ctx.db.insert(ScenarioTable).values({
      workspaceId: "ws_other",
      name: "Other-ws fire-everything",
      evaluation: {
        operator: "AND",
        queries: [
          { attribute: "any.attr", operator: "eq", value: "match" },
        ],
        queryGroups: [],
      },
      actions: [{ type: "assign_tag", value: "leak", enabled: true }],
    });

    const res = await evaluate(ctx, {
      workspaceId: "ws_main",
      customerId: "cust_iso",
      customerData: { "any.attr": "match" },
    });
    const body = await res.json();
    expect(body.evaluated).toBe(true);
    expect(body.triggered).toEqual([]);
    expect(body.evaluations).toEqual([]);
    expect(ctx.rabbit.published).toHaveLength(0);
  });

  test("disabled actions are kept on the row but skipped at trigger time", async () => {
    await ctx.db.insert(ScenarioTable).values({
      workspaceId: "ws_main",
      name: "Mixed actions",
      evaluation: {
        operator: "AND",
        queries: [{ attribute: "flag.a", operator: "eq", value: "yes" }],
        queryGroups: [],
      },
      actions: [
        { type: "set_customer_status", value: "flagged", enabled: true },
        { type: "assign_tag", value: "muted", enabled: false },
      ],
    });

    const res = await evaluate(ctx, {
      workspaceId: "ws_main",
      customerId: "cust_disabled",
      customerData: { "flag.a": "yes" },
    });
    const body = await res.json();
    expect(body.triggered[0].actions).toHaveLength(1);
    expect(body.triggered[0].actions[0].type).toBe("set_customer_status");
    expect(ctx.rabbit.published).toHaveLength(1);
    expect(
      (ctx.rabbit.published[0].payload as { actionType: string }).actionType,
    ).toBe("set_customer_status");
  });

  test("an empty evaluation tree never matches, even with matching attributes", async () => {
    await ctx.db.insert(ScenarioTable).values({
      workspaceId: "ws_main",
      name: "Drafted but empty",
      evaluation: emptyEvaluation(),
      actions: [{ type: "assign_tag", value: "noop", enabled: true }],
    });

    const res = await evaluate(ctx, {
      workspaceId: "ws_main",
      customerId: "cust_empty",
      customerData: { "any.attr": "value" },
    });
    const body = await res.json();
    expect(body.triggered).toEqual([]);
    expect(body.evaluations[0].matched).toBe(false);
    expect(ctx.rabbit.published).toHaveLength(0);
  });
});
