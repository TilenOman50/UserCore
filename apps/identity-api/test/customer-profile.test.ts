// Customer profile lifecycle: rows are created by the kyc.completed event
// handler (RabbitMQ subscriber) and read through the dashboard's table /
// stats / detail endpoints. These integration tests exercise both halves:
// publish an event and confirm the row landed, then read it back via HTTP.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { CustomerProfileTable } from "../src/db/schema.db";
import { fireKycCompleted } from "./utils/events";
import { bootTestApp, type TestApp } from "./utils/testApp";

describe("kyc.completed → customer profile upsert", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("creates a profile when a customer's first KYC submission completes", async () => {
    await fireKycCompleted(ctx.rabbit, {
      workflowSessionId: "session_first_one",
      customerId: "cust_new_user",
      workspaceId: "ws_main",
      status: "approved",
      riskLevel: "low",
      firstName: "Anja",
      lastName: "Novak",
      dateOfBirth: "1992-05-14",
      nationality: "SVN",
      country: "SVN",
    });

    const rows = await ctx.db
      .select()
      .from(CustomerProfileTable)
      .where(eq(CustomerProfileTable.customerId, "cust_new_user"));
    expect(rows).toHaveLength(1);
    expect(rows[0].kycStatus).toBe("approved");
    expect(rows[0].riskLevel).toBe("low");
    expect(rows[0].firstName).toBe("Anja");
    expect(rows[0].country).toBe("SVN");
  });

  test("updates the existing profile on re-verification (same customerId)", async () => {
    // First submission → flagged
    await fireKycCompleted(ctx.rabbit, {
      workflowSessionId: "session_v1",
      customerId: "cust_reverify",
      workspaceId: "ws_main",
      status: "flagged",
      riskLevel: "medium",
      firstName: "Marko",
      lastName: "Horvat",
      dateOfBirth: "1985-02-01",
      nationality: "HRV",
      country: "HRV",
    });

    // Second submission a week later → approved + reclassified as low
    await fireKycCompleted(ctx.rabbit, {
      workflowSessionId: "session_v2",
      customerId: "cust_reverify",
      workspaceId: "ws_main",
      status: "approved",
      riskLevel: "low",
      firstName: "Marko",
      lastName: "Horvat",
      dateOfBirth: "1985-02-01",
      nationality: "HRV",
      country: "HRV",
    });

    const rows = await ctx.db
      .select()
      .from(CustomerProfileTable)
      .where(eq(CustomerProfileTable.customerId, "cust_reverify"));
    expect(rows).toHaveLength(1);
    expect(rows[0].kycStatus).toBe("approved");
    expect(rows[0].riskLevel).toBe("low");
    expect(rows[0].kycSessionId).toBe("session_v2");
  });

  test("ignores malformed event payloads instead of crashing the consumer", async () => {
    await fireKycCompleted(ctx.rabbit, {
      // missing required fields
      randomGarbage: true,
    });
    const rows = await ctx.db.select().from(CustomerProfileTable);
    expect(rows).toHaveLength(0);
  });
});

describe("GET /identity/profiles/customer/:customerId", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("returns the customer profile after a KYC completion", async () => {
    await fireKycCompleted(ctx.rabbit, {
      workflowSessionId: "session_lookup",
      customerId: "cust_lookup",
      workspaceId: "ws_main",
      status: "approved",
      riskLevel: "low",
      firstName: "Ivan",
      lastName: "Kovač",
      dateOfBirth: "1980-01-01",
      nationality: "SVN",
      country: "SVN",
    });

    const res = await ctx.request(
      "/identity/profiles/customer/cust_lookup?workspaceId=ws_main",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.customerId).toBe("cust_lookup");
    expect(body.kycStatus).toBe("approved");
    expect(body.firstName).toBe("Ivan");
  });

  test("returns 404 for an unknown customerId", async () => {
    const res = await ctx.request(
      "/identity/profiles/customer/cust_ghost?workspaceId=ws_main",
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /identity/profiles/workspace/:workspaceId/stats", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("aggregates customer counts by KYC status and risk level", async () => {
    // Seed three customers in workspace A: two approved (low + medium risk),
    // one rejected. Plus one customer in workspace B that should NOT count.
    await fireKycCompleted(ctx.rabbit, {
      workflowSessionId: "s1",
      customerId: "c1",
      workspaceId: "ws_stats",
      status: "approved",
      riskLevel: "low",
    });
    await fireKycCompleted(ctx.rabbit, {
      workflowSessionId: "s2",
      customerId: "c2",
      workspaceId: "ws_stats",
      status: "approved",
      riskLevel: "medium",
    });
    await fireKycCompleted(ctx.rabbit, {
      workflowSessionId: "s3",
      customerId: "c3",
      workspaceId: "ws_stats",
      status: "rejected",
      riskLevel: "high",
    });
    // Other-workspace noise that must be excluded
    await fireKycCompleted(ctx.rabbit, {
      workflowSessionId: "s4",
      customerId: "c4",
      workspaceId: "ws_other",
      status: "approved",
      riskLevel: "low",
    });

    const res = await ctx.request("/identity/profiles/workspace/ws_stats/stats");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    const byStatus = Object.fromEntries(
      (body.byStatus as { status: string; count: number }[]).map((r) => [
        r.status,
        r.count,
      ]),
    );
    expect(byStatus.approved).toBe(2);
    expect(byStatus.rejected).toBe(1);
  });
});
