// Dashboard preferences — edge cases around the PUT/GET upsert. Documents
// the actual cross-workspace behaviour (the row is keyed by memberId, so a
// re-PUT from a different workspace replaces the workspaceId), plus
// empty-object and large-blob handling, and the platform endpoints
// (/health, /openapi.json).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { DashboardMemberSettingsTable } from "../src/db/schema.db";
import { bootTestApp, type TestApp } from "./utils/testApp";

describe("Dashboard preferences — edge cases", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("GET with an unknown memberId returns 404", async () => {
    const res = await ctx.request(
      "/dashboard-api/members/member_does_not_exist/settings",
    );
    expect(res.status).toBe(404);
  });

  test("PUT with empty preferences {} is stored + returned as {}", async () => {
    const put = await ctx.request(
      "/dashboard-api/members/member_empty/settings",
      {
        method: "PUT",
        body: JSON.stringify({ workspaceId: "ws_empty", preferences: {} }),
      },
    );
    expect(put.status).toBe(200);
    const putBody = await put.json();
    expect(putBody.preferences).toEqual({});

    const get = await ctx.request(
      "/dashboard-api/members/member_empty/settings",
    );
    expect(get.status).toBe(200);
    const getBody = await get.json();
    // GET round-trips as the same empty object — NOT null.
    expect(getBody.preferences).toEqual({});
  });

  test("PUT with preferences omitted creates the row; preferences column lands as null", async () => {
    const res = await ctx.request(
      "/dashboard-api/members/member_no_prefs/settings",
      {
        method: "PUT",
        body: JSON.stringify({ workspaceId: "ws_no_prefs" }),
      },
    );
    expect(res.status).toBe(200);

    // Confirm the DB stored a NULL for the nullable jsonb column.
    const row = await ctx.db.query.DashboardMemberSettingsTable.findFirst({
      where: eq(DashboardMemberSettingsTable.memberId, "member_no_prefs"),
    });
    expect(row).toBeDefined();
    expect(row?.preferences).toBeNull();
  });

  test("re-PUT with a DIFFERENT workspaceId leaves workspaceId untouched (member-scoped, memberId is the unique key)", async () => {
    await ctx.request("/dashboard-api/members/member_xws/settings", {
      method: "PUT",
      body: JSON.stringify({
        workspaceId: "ws_alpha",
        preferences: { theme: "dark" },
      }),
    });
    const second = await ctx.request(
      "/dashboard-api/members/member_xws/settings",
      {
        method: "PUT",
        body: JSON.stringify({
          workspaceId: "ws_beta",
          preferences: { theme: "light" },
        }),
      },
    );
    expect(second.status).toBe(200);
    const body = await second.json();

    // Actual behaviour: onConflictDoUpdate.set() only updates `preferences`
    // and `updatedAt`. The original workspaceId from the INSERT path sticks.
    // Document this so future refactors don't silently flip it.
    expect(body.workspaceId).toBe("ws_alpha");
    expect(body.preferences).toEqual({ theme: "light" });
  });

  test("PUT with a large preferences blob (~500 keys) round-trips intact", async () => {
    const big: Record<string, number> = {};
    for (let i = 0; i < 500; i++) {
      big[`key_${i}`] = i;
    }

    const put = await ctx.request(
      "/dashboard-api/members/member_big/settings",
      {
        method: "PUT",
        body: JSON.stringify({ workspaceId: "ws_big", preferences: big }),
      },
    );
    expect(put.status).toBe(200);

    const get = await ctx.request(
      "/dashboard-api/members/member_big/settings",
    );
    const body = await get.json();
    expect(Object.keys(body.preferences).length).toBe(500);
    expect(body.preferences.key_0).toBe(0);
    expect(body.preferences.key_499).toBe(499);
  });

  test("GET /health returns 200 OK", async () => {
    const res = await ctx.request("/health");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("OK");
  });

  test("GET /dashboard-api/openapi.json returns the dashboard API spec", async () => {
    const res = await ctx.request("/dashboard-api/openapi.json");
    expect(res.status).toBe(200);
    const spec = await res.json();
    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info.title).toBe("UserCore Dashboard API");
  });
});
