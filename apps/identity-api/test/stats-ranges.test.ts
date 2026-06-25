// GET /profiles/workspace/:workspaceId/stats — the range= query restricts the
// aggregations to a recent window measured against createdAt. We seed rows
// with explicit createdAt timestamps so the window math is deterministic.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { CustomerProfileTable } from "../src/db/schema.db";
import { bootTestApp, type TestApp } from "./utils/testApp";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Insert a profile straight into the table so we can pin createdAt and
// kycCompletedAt. Skips the kyc.completed → upsert path on purpose.
const insertProfile = async (
  ctx: TestApp,
  row: {
    customerId: string;
    workspaceId: string;
    kycStatus?: "not_started" | "pending" | "approved" | "rejected" | "flagged";
    createdAt: Date;
  },
) => {
  await ctx.db.insert(CustomerProfileTable).values({
    customerId: row.customerId,
    workspaceId: row.workspaceId,
    kycStatus: row.kycStatus ?? "approved",
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
  });
};

describe("GET /identity/profiles/workspace/:workspaceId/stats with range=", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();

    const now = Date.now();
    // Three "recent" rows — all within the last hour
    await insertProfile(ctx, {
      customerId: "cust_now_a",
      workspaceId: "ws_main",
      createdAt: new Date(now - 5 * 60 * 1000),
    });
    await insertProfile(ctx, {
      customerId: "cust_now_b",
      workspaceId: "ws_main",
      createdAt: new Date(now - 30 * 60 * 1000),
    });
    await insertProfile(ctx, {
      customerId: "cust_now_c",
      workspaceId: "ws_main",
      createdAt: new Date(now - 2 * HOUR_MS),
    });
    // One row from 3 days ago — inside week, outside 24h
    await insertProfile(ctx, {
      customerId: "cust_3d",
      workspaceId: "ws_main",
      createdAt: new Date(now - 3 * DAY_MS),
    });
    // One row from 30 days ago — outside week
    await insertProfile(ctx, {
      customerId: "cust_30d",
      workspaceId: "ws_main",
      createdAt: new Date(now - 30 * DAY_MS),
    });
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("range=all returns every row regardless of age", async () => {
    const res = await ctx.request(
      "/identity/profiles/workspace/ws_main/stats?range=all",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(5);
  });

  test("range=24h excludes rows older than 24 hours", async () => {
    const res = await ctx.request(
      "/identity/profiles/workspace/ws_main/stats?range=24h",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // Only the three "now" rows fall inside the 24h window.
    expect(body.total).toBe(3);
  });

  test("range=week excludes rows older than 7 days", async () => {
    const res = await ctx.request(
      "/identity/profiles/workspace/ws_main/stats?range=week",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // Three "now" rows + the 3-day-old row = 4. The 30-day row is excluded.
    expect(body.total).toBe(4);
  });

  test("workspace isolation — ws_other customers don't leak into ws_main stats", async () => {
    await insertProfile(ctx, {
      customerId: "cust_other_ws",
      workspaceId: "ws_other",
      createdAt: new Date(),
    });
    const res = await ctx.request(
      "/identity/profiles/workspace/ws_main/stats?range=all",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // Still 5 in ws_main; ws_other is not aggregated here.
    expect(body.total).toBe(5);
  });
});
