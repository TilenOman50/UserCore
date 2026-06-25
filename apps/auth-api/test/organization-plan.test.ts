// Internal org-plan lookup. workflows-api hits this endpoint server-to-
// server every time it creates a session, to enforce per-plan quotas. The
// response carries the plan tier + the member + workspace counts (also
// gated in the dashboard's plan settings page).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { seedOrg } from "./utils/seed";
import { bootTestApp, type TestApp } from "./utils/testApp";

describe("GET /auth/internal/organizations/:id", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("returns the org snapshot + plan + counts", async () => {
    await seedOrg(ctx, {
      id: "org_with_team",
      plan: "GROWTH",
      members: 3,
      workspaces: 2,
    });

    const res = await ctx.request(
      "/auth/internal/organizations/org_with_team",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("org_with_team");
    expect(body.plan).toBe("GROWTH");
    expect(body.counts.members).toBe(3);
    expect(body.counts.workspaces).toBe(2);
  });

  test("counts are zero for a fresh org with no members or workspaces yet", async () => {
    await seedOrg(ctx, {
      id: "org_solo",
      plan: "STARTER",
    });

    const res = await ctx.request("/auth/internal/organizations/org_solo");
    const body = await res.json();
    expect(body.plan).toBe("STARTER");
    expect(body.counts.members).toBe(0);
    expect(body.counts.workspaces).toBe(0);
  });

  test("returns 404 for an unknown organization id", async () => {
    const res = await ctx.request(
      "/auth/internal/organizations/org_never_existed",
    );
    expect(res.status).toBe(404);
  });

  test("plan is one of the canonical tiers (no orphan values)", async () => {
    await seedOrg(ctx, { id: "org_starter", plan: "STARTER" });
    await seedOrg(ctx, { id: "org_growth", plan: "GROWTH" });
    await seedOrg(ctx, { id: "org_enterprise", plan: "ENTERPRISE" });
    for (const id of ["org_starter", "org_growth", "org_enterprise"]) {
      const res = await ctx.request(`/auth/internal/organizations/${id}`);
      const body = await res.json();
      expect(["STARTER", "GROWTH", "ENTERPRISE"]).toContain(body.plan);
    }
  });
});
