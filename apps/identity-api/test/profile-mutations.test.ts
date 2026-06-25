// Mutation endpoints on customer profiles: the POST /profiles factory and
// the three PATCH endpoints used by the dashboard reviewer to override KYC
// status, archive/unarchive, and reclassify risk. These exercise the
// HTTP surface end-to-end (router → service → repository → PGLite).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { CustomerProfileTable } from "../src/db/schema.db";
import { fireKycCompleted } from "./utils/events";
import { bootTestApp, type TestApp } from "./utils/testApp";

describe("POST /identity/profiles", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("creates a profile with all identity fields populated", async () => {
    const res = await ctx.request("/identity/profiles", {
      method: "POST",
      body: JSON.stringify({
        customerId: "cust_full",
        workspaceId: "ws_main",
        firstName: "Anja",
        lastName: "Novak",
        dateOfBirth: "1992-05-14",
        nationality: "SVN",
        address: "Slovenska 1",
        city: "Ljubljana",
        country: "SVN",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.customerId).toBe("cust_full");
    expect(body.workspaceId).toBe("ws_main");
    expect(body.firstName).toBe("Anja");
    expect(body.lastName).toBe("Novak");
    expect(body.dateOfBirth).toBe("1992-05-14");
    expect(body.nationality).toBe("SVN");
    expect(body.address).toBe("Slovenska 1");
    expect(body.city).toBe("Ljubljana");
    expect(body.country).toBe("SVN");
    // Default KYC status applies even when not supplied
    expect(body.kycStatus).toBe("not_started");
  });

  test("creates a profile with only the required fields, leaving identity nulled", async () => {
    const res = await ctx.request("/identity/profiles", {
      method: "POST",
      body: JSON.stringify({
        customerId: "cust_min",
        workspaceId: "ws_main",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.customerId).toBe("cust_min");
    expect(body.firstName).toBeNull();
    expect(body.lastName).toBeNull();
    expect(body.dateOfBirth).toBeNull();
    expect(body.nationality).toBeNull();
    expect(body.address).toBeNull();
    expect(body.city).toBeNull();
    expect(body.country).toBeNull();
    expect(body.riskLevel).toBeNull();
    expect(body.kycSessionId).toBeNull();
    expect(body.kycCompletedAt).toBeNull();
    expect(body.archivedAt).toBeNull();
  });

  test("rejects a duplicate customerId — the column is uniquely indexed", async () => {
    const first = await ctx.request("/identity/profiles", {
      method: "POST",
      body: JSON.stringify({
        customerId: "cust_dup",
        workspaceId: "ws_main",
      }),
    });
    expect(first.status).toBe(201);

    const second = await ctx.request("/identity/profiles", {
      method: "POST",
      body: JSON.stringify({
        customerId: "cust_dup",
        workspaceId: "ws_main",
      }),
    });
    // The repository hits the unique constraint and the error bubbles up
    // as a 500 from the onError handler (we don't pre-check for existence).
    expect(second.status).toBeGreaterThanOrEqual(400);

    const rows = await ctx.db
      .select()
      .from(CustomerProfileTable)
      .where(eq(CustomerProfileTable.customerId, "cust_dup"));
    expect(rows).toHaveLength(1);
  });
});

describe("PATCH /identity/profiles/customer/:customerId/kyc-status", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // Seed a clean profile via POST so kycCompletedAt starts null.
  const seedFreshProfile = async (customerId: string) => {
    await ctx.request("/identity/profiles", {
      method: "POST",
      body: JSON.stringify({ customerId, workspaceId: "ws_main" }),
    });
  };

  test("approved → kycCompletedAt is set to the current time", async () => {
    await seedFreshProfile("cust_approve");
    const before = Date.now();
    const res = await ctx.request(
      "/identity/profiles/customer/cust_approve/kyc-status",
      {
        method: "PATCH",
        body: JSON.stringify({ kycStatus: "approved" }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kycStatus).toBe("approved");
    expect(body.kycCompletedAt).not.toBeNull();
    const completedAt = new Date(body.kycCompletedAt).getTime();
    expect(completedAt).toBeGreaterThanOrEqual(before);
    expect(completedAt).toBeLessThanOrEqual(Date.now());
  });

  test("rejected → kycCompletedAt is also set (terminal decision)", async () => {
    await seedFreshProfile("cust_reject");
    const res = await ctx.request(
      "/identity/profiles/customer/cust_reject/kyc-status",
      {
        method: "PATCH",
        body: JSON.stringify({ kycStatus: "rejected" }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kycStatus).toBe("rejected");
    expect(body.kycCompletedAt).not.toBeNull();
  });

  test("re-decision without riskLevel preserves the existing classification", async () => {
    // Seed via kyc.completed so the row has a riskLevel already.
    await fireKycCompleted(ctx.rabbit, {
      workflowSessionId: "s_risk",
      customerId: "cust_risk",
      workspaceId: "ws_main",
      status: "approved",
      riskLevel: "high",
    });

    const res = await ctx.request(
      "/identity/profiles/customer/cust_risk/kyc-status",
      {
        method: "PATCH",
        body: JSON.stringify({ kycStatus: "approved" }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // No risk in the payload → keep what was there.
    expect(body.riskLevel).toBe("high");
  });
});

describe("PATCH /identity/profiles/customer/:customerId/archive", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("archive=true sets archivedAt to a non-null timestamp", async () => {
    await ctx.request("/identity/profiles", {
      method: "POST",
      body: JSON.stringify({
        customerId: "cust_archive",
        workspaceId: "ws_main",
      }),
    });
    const res = await ctx.request(
      "/identity/profiles/customer/cust_archive/archive",
      {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.archivedAt).not.toBeNull();
    // Round-trip the timestamp to ensure it's a real ISO date string
    expect(Number.isNaN(new Date(body.archivedAt).getTime())).toBe(false);
  });

  test("archive=false clears archivedAt back to null", async () => {
    await ctx.request("/identity/profiles", {
      method: "POST",
      body: JSON.stringify({
        customerId: "cust_unarchive",
        workspaceId: "ws_main",
      }),
    });
    // Archive first
    await ctx.request(
      "/identity/profiles/customer/cust_unarchive/archive",
      {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      },
    );
    // Then unarchive
    const res = await ctx.request(
      "/identity/profiles/customer/cust_unarchive/archive",
      {
        method: "PATCH",
        body: JSON.stringify({ archived: false }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.archivedAt).toBeNull();
  });
});

describe("PATCH /identity/profiles/customer/:customerId/classification", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("applies status + risk and preserves kycSessionId + kycCompletedAt", async () => {
    // Seed via kyc.completed so kycSessionId and kycCompletedAt are set.
    // We use "approved" because the service only stamps kycCompletedAt on
    // terminal decisions (approved/rejected) — "flagged" leaves it null.
    await fireKycCompleted(ctx.rabbit, {
      workflowSessionId: "session_classify",
      customerId: "cust_classify",
      workspaceId: "ws_main",
      status: "approved",
      riskLevel: "medium",
    });

    // Confirm the seed state
    const seeded = await ctx.db
      .select()
      .from(CustomerProfileTable)
      .where(eq(CustomerProfileTable.customerId, "cust_classify"));
    const seededKycCompletedAt = seeded[0].kycCompletedAt;
    expect(seeded[0].kycSessionId).toBe("session_classify");
    expect(seededKycCompletedAt).not.toBeNull();

    const res = await ctx.request(
      "/identity/profiles/customer/cust_classify/classification",
      {
        method: "PATCH",
        body: JSON.stringify({ kycStatus: "rejected", riskLevel: "low" }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kycStatus).toBe("rejected");
    expect(body.riskLevel).toBe("low");
    // The KYC session link and completion timestamp must survive a manual
    // reclassification — they belong to the original decision.
    expect(body.kycSessionId).toBe("session_classify");
    expect(body.kycCompletedAt).toBe(seededKycCompletedAt!.toISOString());
  });
});
