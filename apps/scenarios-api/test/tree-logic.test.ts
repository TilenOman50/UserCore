// AND/OR group composition + multi-scenario evaluation. The rule engine
// recurses through `queryGroups`, so we exercise both shapes of nesting and
// confirm the multi-scenario fan-out (response + rabbit publishes) behaves.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { EVENTS, type ScenarioEvaluation } from "@usercore/shared-types";

import { ScenarioTable } from "../src/db/schema.db";
import { bootTestApp, type TestApp } from "./utils/testApp";

const evaluate = (ctx: TestApp, body: Record<string, unknown>) =>
  ctx.request("/scenarios/evaluate", {
    method: "POST",
    body: JSON.stringify(body),
  });

const seed = (ctx: TestApp, name: string, evaluation: ScenarioEvaluation) =>
  ctx.db.insert(ScenarioTable).values({
    workspaceId: "ws_main",
    name,
    evaluation,
    actions: [{ type: "assign_tag", value: name, enabled: true }],
  });

describe("evaluation tree logic", () => {
  let ctx: TestApp;
  beforeEach(async () => {
    ctx = await bootTestApp();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  test("AND group: all conditions true → matches", async () => {
    await seed(ctx, "and_all_true", {
      operator: "AND",
      queries: [
        { attribute: "flag.a", operator: "eq", value: "yes" },
        { attribute: "flag.b", operator: "eq", value: "yes" },
      ],
      queryGroups: [],
    });

    const body = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_and_pass",
        customerData: { "flag.a": "yes", "flag.b": "yes" },
      })
    ).json();
    expect(body.evaluations[0].matched).toBe(true);
    expect(body.triggered).toHaveLength(1);
  });

  test("AND group: one condition false → does not match", async () => {
    await seed(ctx, "and_one_false", {
      operator: "AND",
      queries: [
        { attribute: "flag.a", operator: "eq", value: "yes" },
        { attribute: "flag.b", operator: "eq", value: "yes" },
      ],
      queryGroups: [],
    });

    const body = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_and_fail",
        customerData: { "flag.a": "yes", "flag.b": "no" },
      })
    ).json();
    expect(body.evaluations[0].matched).toBe(false);
    expect(body.triggered).toEqual([]);
  });

  test("OR group: one condition true → matches", async () => {
    await seed(ctx, "or_one_true", {
      operator: "OR",
      queries: [
        { attribute: "flag.a", operator: "eq", value: "yes" },
        { attribute: "flag.b", operator: "eq", value: "yes" },
      ],
      queryGroups: [],
    });

    const body = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_or_partial",
        customerData: { "flag.a": "no", "flag.b": "yes" },
      })
    ).json();
    expect(body.evaluations[0].matched).toBe(true);
    expect(body.triggered).toHaveLength(1);
  });

  test("OR group: all conditions false → does not match", async () => {
    await seed(ctx, "or_all_false", {
      operator: "OR",
      queries: [
        { attribute: "flag.a", operator: "eq", value: "yes" },
        { attribute: "flag.b", operator: "eq", value: "yes" },
      ],
      queryGroups: [],
    });

    const body = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_or_none",
        customerData: { "flag.a": "no", "flag.b": "no" },
      })
    ).json();
    expect(body.evaluations[0].matched).toBe(false);
    expect(body.triggered).toEqual([]);
  });

  test("nested AND inside OR: (A AND B) OR C — the AND branch alone can match", async () => {
    // Tree: OR
    //         ├── nested group AND(A, B)
    //         └── C
    const tree: ScenarioEvaluation = {
      operator: "OR",
      queries: [{ attribute: "flag.c", operator: "eq", value: "yes" }],
      queryGroups: [
        {
          operator: "AND",
          queries: [
            { attribute: "flag.a", operator: "eq", value: "yes" },
            { attribute: "flag.b", operator: "eq", value: "yes" },
          ],
          queryGroups: [],
        },
      ],
    };
    await seed(ctx, "or_with_and", tree);

    // Inner AND matches, C is false → overall OR is true.
    const andBranch = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_and_branch",
        customerData: { "flag.a": "yes", "flag.b": "yes", "flag.c": "no" },
      })
    ).json();
    expect(andBranch.evaluations[0].matched).toBe(true);

    // Only C is true, AND branch fails → overall OR still true.
    const cBranch = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_c_branch",
        customerData: { "flag.a": "no", "flag.b": "yes", "flag.c": "yes" },
      })
    ).json();
    expect(cBranch.evaluations[0].matched).toBe(true);

    // None of the branches succeed → overall false.
    const noBranch = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_no_branch",
        customerData: { "flag.a": "yes", "flag.b": "no", "flag.c": "no" },
      })
    ).json();
    expect(noBranch.evaluations[0].matched).toBe(false);
  });

  test("nested OR inside AND: (A OR B) AND C — C is required", async () => {
    // Tree: AND
    //         ├── C
    //         └── nested group OR(A, B)
    const tree: ScenarioEvaluation = {
      operator: "AND",
      queries: [{ attribute: "flag.c", operator: "eq", value: "yes" }],
      queryGroups: [
        {
          operator: "OR",
          queries: [
            { attribute: "flag.a", operator: "eq", value: "yes" },
            { attribute: "flag.b", operator: "eq", value: "yes" },
          ],
          queryGroups: [],
        },
      ],
    };
    await seed(ctx, "and_with_or", tree);

    // A satisfies the inner OR + C satisfies the outer AND → match.
    const aPath = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_a_and_c",
        customerData: { "flag.a": "yes", "flag.b": "no", "flag.c": "yes" },
      })
    ).json();
    expect(aPath.evaluations[0].matched).toBe(true);

    // Inner OR matches (B) but C is missing → outer AND fails.
    const noC = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_no_c",
        customerData: { "flag.a": "no", "flag.b": "yes", "flag.c": "no" },
      })
    ).json();
    expect(noC.evaluations[0].matched).toBe(false);

    // C is set but neither A nor B → inner OR fails → outer AND fails.
    const onlyC = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_only_c",
        customerData: { "flag.a": "no", "flag.b": "no", "flag.c": "yes" },
      })
    ).json();
    expect(onlyC.evaluations[0].matched).toBe(false);
  });

  test("multiple scenarios all matching: each gets its own evaluation + rabbit event", async () => {
    await seed(ctx, "scn_a", {
      operator: "AND",
      queries: [{ attribute: "flag.a", operator: "eq", value: "yes" }],
      queryGroups: [],
    });
    await seed(ctx, "scn_b", {
      operator: "AND",
      queries: [{ attribute: "flag.b", operator: "eq", value: "yes" }],
      queryGroups: [],
    });
    await seed(ctx, "scn_c", {
      operator: "AND",
      queries: [{ attribute: "flag.c", operator: "eq", value: "yes" }],
      queryGroups: [],
    });

    const body = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_all_match",
        customerData: { "flag.a": "yes", "flag.b": "yes", "flag.c": "yes" },
      })
    ).json();
    expect(body.evaluations).toHaveLength(3);
    expect(body.evaluations.every((e: { matched: boolean }) => e.matched)).toBe(
      true,
    );
    expect(body.triggered).toHaveLength(3);
    // One enabled action per scenario → exactly three rabbit publishes.
    expect(ctx.rabbit.published).toHaveLength(3);
    expect(
      ctx.rabbit.published.every((p) => p.routingKey === EVENTS.SCENARIO_TRIGGERED),
    ).toBe(true);
    const tags = ctx.rabbit.published.map(
      (p) => (p.payload as { actionValue: string }).actionValue,
    );
    expect(tags.sort()).toEqual(["scn_a", "scn_b", "scn_c"]);
  });

  test("mixed batch: 1 of 3 scenarios matches → evaluations show all 3, exactly 1 rabbit event", async () => {
    await seed(ctx, "scn_match", {
      operator: "AND",
      queries: [{ attribute: "flag.a", operator: "eq", value: "yes" }],
      queryGroups: [],
    });
    await seed(ctx, "scn_miss_1", {
      operator: "AND",
      queries: [{ attribute: "flag.b", operator: "eq", value: "yes" }],
      queryGroups: [],
    });
    await seed(ctx, "scn_miss_2", {
      operator: "AND",
      queries: [{ attribute: "flag.c", operator: "eq", value: "yes" }],
      queryGroups: [],
    });

    const body = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_mixed",
        customerData: { "flag.a": "yes", "flag.b": "no", "flag.c": "no" },
      })
    ).json();
    expect(body.evaluations).toHaveLength(3);
    const byName = Object.fromEntries(
      body.evaluations.map((e: { name: string; matched: boolean }) => [
        e.name,
        e.matched,
      ]),
    );
    expect(byName.scn_match).toBe(true);
    expect(byName.scn_miss_1).toBe(false);
    expect(byName.scn_miss_2).toBe(false);
    expect(body.triggered).toHaveLength(1);
    expect(body.triggered[0].name).toBe("scn_match");
    expect(ctx.rabbit.published).toHaveLength(1);
    expect(
      (ctx.rabbit.published[0].payload as { actionValue: string }).actionValue,
    ).toBe("scn_match");
  });
});
