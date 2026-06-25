// Dashboard preferences: per-member JSON blob used to persist UI state
// (table filters, default workspace, last-viewed customer, etc.) across
// devices. PUT upserts; GET reads.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { bootTestApp, type TestApp } from "./utils/testApp";

describe("Dashboard member settings", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("404 when no settings exist for the member yet", async () => {
    const res = await ctx.request(
      "/dashboard-api/members/member_new/settings",
    );
    expect(res.status).toBe(404);
  });

  test("PUT creates a fresh settings row when none exists", async () => {
    const res = await ctx.request(
      "/dashboard-api/members/member_a/settings",
      {
        method: "PUT",
        body: JSON.stringify({
          workspaceId: "ws_a",
          preferences: {
            "customers-table": { status: "approved", country: ["SVN"] },
          },
        }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.memberId).toBe("member_a");
    expect(body.preferences["customers-table"]).toEqual({
      status: "approved",
      country: ["SVN"],
    });
  });

  test("PUT updates the same row on conflict (upsert semantics)", async () => {
    await ctx.request("/dashboard-api/members/member_b/settings", {
      method: "PUT",
      body: JSON.stringify({
        workspaceId: "ws_b",
        preferences: { theme: "dark" },
      }),
    });
    const update = await ctx.request(
      "/dashboard-api/members/member_b/settings",
      {
        method: "PUT",
        body: JSON.stringify({
          workspaceId: "ws_b",
          preferences: { theme: "light", density: "compact" },
        }),
      },
    );
    expect(update.status).toBe(200);
    const updated = await update.json();
    expect(updated.preferences).toEqual({
      theme: "light",
      density: "compact",
    });
  });

  test("GET returns the most recently saved preferences blob", async () => {
    await ctx.request("/dashboard-api/members/member_c/settings", {
      method: "PUT",
      body: JSON.stringify({
        workspaceId: "ws_c",
        preferences: { lang: "en", "customers-table": { risk: ["high"] } },
      }),
    });
    const res = await ctx.request(
      "/dashboard-api/members/member_c/settings",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferences.lang).toBe("en");
    expect(body.preferences["customers-table"].risk).toEqual(["high"]);
  });
});
