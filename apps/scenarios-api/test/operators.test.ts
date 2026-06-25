// Per-operator coverage for the rule engine. Each operator is exercised with
// both a matching and a non-matching customer attribute set, plus a couple of
// edge cases (boundary comparisons, boolean handling, missing attributes).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { RuleOperator } from "@usercore/shared-types";

import { ScenarioTable } from "../src/db/schema.db";
import { bootTestApp, type TestApp } from "./utils/testApp";

const evaluate = (ctx: TestApp, body: Record<string, unknown>) =>
  ctx.request("/scenarios/evaluate", {
    method: "POST",
    body: JSON.stringify(body),
  });

const seedScenario = (
  ctx: TestApp,
  attribute: string,
  operator: RuleOperator,
  value: string,
  name = "Operator scenario",
) =>
  ctx.db.insert(ScenarioTable).values({
    workspaceId: "ws_main",
    name,
    evaluation: {
      operator: "AND",
      queries: [{ attribute, operator, value }],
      queryGroups: [],
    },
    actions: [{ type: "assign_tag", value: "matched", enabled: true }],
  });

describe("rule operators", () => {
  let ctx: TestApp;
  beforeEach(async () => {
    ctx = await bootTestApp();
  });
  afterEach(async () => {
    await ctx.cleanup();
  });

  test("eq matches when string nationality equals the rule value, otherwise it doesn't", async () => {
    await seedScenario(
      ctx,
      "identity_verification.document_nationality",
      "eq",
      "SVN",
    );

    const match = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_svn",
        customerData: {
          "identity_verification.document_nationality": "SVN",
        },
      })
    ).json();
    expect(match.triggered).toHaveLength(1);
    expect(match.evaluations[0].matched).toBe(true);

    const miss = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_deu",
        customerData: {
          "identity_verification.document_nationality": "DEU",
        },
      })
    ).json();
    expect(miss.triggered).toEqual([]);
    expect(miss.evaluations[0].matched).toBe(false);
  });

  test("neq matches when the customer value differs from the rule value", async () => {
    await seedScenario(
      ctx,
      "identity_verification.document_nationality",
      "neq",
      "SVN",
    );

    const match = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_deu",
        customerData: {
          "identity_verification.document_nationality": "DEU",
        },
      })
    ).json();
    expect(match.evaluations[0].matched).toBe(true);

    const miss = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_svn",
        customerData: {
          "identity_verification.document_nationality": "SVN",
        },
      })
    ).json();
    expect(miss.evaluations[0].matched).toBe(false);
  });

  test("gt on derived age: 45 > 40 matches, 30 > 40 doesn't", async () => {
    await seedScenario(ctx, "identity_verification.age", "gt", "40");

    const match = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_45",
        customerData: { "identity_verification.date_of_birth": "1980-06-01" },
      })
    ).json();
    expect(match.evaluations[0].matched).toBe(true);

    const miss = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_30",
        customerData: { "identity_verification.date_of_birth": "1995-06-01" },
      })
    ).json();
    expect(miss.evaluations[0].matched).toBe(false);
  });

  test("gte on derived age boundary: 18 >= 18 matches, 17 >= 18 doesn't", async () => {
    await seedScenario(ctx, "identity_verification.age", "gte", "18");

    // Today is 2026-06-25. A DOB of 2008-06-25 makes the customer exactly 18.
    const match = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_18",
        customerData: { "identity_verification.date_of_birth": "2008-06-25" },
      })
    ).json();
    expect(match.evaluations[0].matched).toBe(true);

    const miss = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_17",
        customerData: { "identity_verification.date_of_birth": "2009-06-25" },
      })
    ).json();
    expect(miss.evaluations[0].matched).toBe(false);
  });

  test("lt on a numeric fraud score: 30 < 40 matches, 50 < 40 doesn't", async () => {
    await seedScenario(ctx, "fraud_detection.fraud_score", "lt", "40");

    const match = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_low_risk",
        customerData: { "fraud_detection.fraud_score": 30 },
      })
    ).json();
    expect(match.evaluations[0].matched).toBe(true);

    const miss = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_high_risk",
        customerData: { "fraud_detection.fraud_score": 50 },
      })
    ).json();
    expect(miss.evaluations[0].matched).toBe(false);
  });

  test("lte on derived age boundary: 18 <= 18 matches, 19 <= 18 doesn't", async () => {
    await seedScenario(ctx, "identity_verification.age", "lte", "18");

    const match = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_18",
        customerData: { "identity_verification.date_of_birth": "2008-06-25" },
      })
    ).json();
    expect(match.evaluations[0].matched).toBe(true);

    const miss = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_19",
        customerData: { "identity_verification.date_of_birth": "2007-01-01" },
      })
    ).json();
    expect(miss.evaluations[0].matched).toBe(false);
  });

  test("in matches when the nationality is in the comma-separated list, otherwise not", async () => {
    await seedScenario(
      ctx,
      "identity_verification.document_nationality",
      "in",
      "SVN,HRV,DEU",
    );

    const match = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_svn",
        customerData: {
          "identity_verification.document_nationality": "SVN",
        },
      })
    ).json();
    expect(match.evaluations[0].matched).toBe(true);

    const miss = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_usa",
        customerData: {
          "identity_verification.document_nationality": "USA",
        },
      })
    ).json();
    expect(miss.evaluations[0].matched).toBe(false);
  });

  test("nin matches when the customer value is NOT in the list", async () => {
    await seedScenario(
      ctx,
      "identity_verification.document_nationality",
      "nin",
      "SVN,HRV,DEU",
    );

    const match = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_usa",
        customerData: {
          "identity_verification.document_nationality": "USA",
        },
      })
    ).json();
    expect(match.evaluations[0].matched).toBe(true);

    const miss = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_svn",
        customerData: {
          "identity_verification.document_nationality": "SVN",
        },
      })
    ).json();
    expect(miss.evaluations[0].matched).toBe(false);
  });

  test("contains is case-insensitive substring match on a free-text attribute", async () => {
    // Free-text attribute (no entry in the catalog) — country normalization is
    // skipped, so we get a plain string compare lowercased on both sides.
    await seedScenario(ctx, "address.full", "contains", "Slovenia");

    const match = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_lj",
        customerData: { "address.full": "Ljubljana, Slovenia" },
      })
    ).json();
    expect(match.evaluations[0].matched).toBe(true);

    // Case-insensitive: lowercase "slovenia" in the customer data still
    // matches the "Slovenia" rule value — the engine lowercases both sides.
    const matchLowercase = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_lj_lc",
        customerData: { "address.full": "ljubljana, slovenia" },
      })
    ).json();
    expect(matchLowercase.evaluations[0].matched).toBe(true);

    const miss = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_berlin",
        customerData: { "address.full": "Berlin, Germany" },
      })
    ).json();
    expect(miss.evaluations[0].matched).toBe(false);
  });

  test("eq on a boolean attribute matches true vs false", async () => {
    await seedScenario(ctx, "fraud_detection.vpn", "eq", "true");

    const match = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_vpn",
        customerData: { "fraud_detection.vpn": true },
      })
    ).json();
    expect(match.evaluations[0].matched).toBe(true);

    const miss = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_no_vpn",
        customerData: { "fraud_detection.vpn": false },
      })
    ).json();
    expect(miss.evaluations[0].matched).toBe(false);
  });

  test("missing customer attribute: condition is recorded but the scenario doesn't match", async () => {
    // Attribute not present in the catalog or in customerData. The engine
    // treats it as undefined → condition returns false, no crash.
    await seedScenario(
      ctx,
      "identity_verification.never_set_attribute",
      "eq",
      "anything",
    );

    const res = await evaluate(ctx, {
      workspaceId: "ws_main",
      customerId: "cust_missing_attr",
      customerData: {
        // Unrelated attribute, so the rule's target really is missing.
        "identity_verification.document_nationality": "SVN",
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.evaluations[0].matched).toBe(false);
    // The condition is still flattened into the evaluation report so the
    // reviewer can see why it failed.
    expect(body.evaluations[0].conditions).toHaveLength(1);
    expect(body.evaluations[0].conditions[0].passed).toBe(false);
    expect(body.evaluations[0].conditions[0].attribute).toBe(
      "identity_verification.never_set_attribute",
    );
    expect(body.triggered).toEqual([]);
    expect(ctx.rabbit.published).toHaveLength(0);
  });

  test("country attribute normalization: alpha-2 customer value matches an alpha-3 rule via eq", async () => {
    // Cross-checks the country-normalization path for a single-value operator
    // (the existing test only covers `in`). Customer arrives with "RU", the
    // rule is stored in alpha-3 "RUS" — both should resolve to "RUS".
    await seedScenario(
      ctx,
      "identity_verification.document_nationality",
      "eq",
      "RUS",
    );

    const match = await (
      await evaluate(ctx, {
        workspaceId: "ws_main",
        customerId: "cust_ru",
        customerData: {
          "identity_verification.document_nationality": "RU",
        },
      })
    ).json();
    expect(match.evaluations[0].matched).toBe(true);
  });
});
