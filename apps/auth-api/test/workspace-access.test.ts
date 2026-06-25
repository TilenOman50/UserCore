// Workspace access: explicit per-user access rows for plain members.
// Owners/admins implicitly see every workspace in their org, so these
// endpoints exist purely to manage the access list for non-manager members.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";

import { WorkspaceAccessTable } from "../src/db/schema.db";
import { seedOrg } from "./utils/seed";
import { bootTestApp, type TestApp } from "./utils/testApp";

describe("Workspace access", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("GET /auth/workspaces/:id/access lists members with explicit access", async () => {
    const org = await seedOrg(ctx, {
      id: "org_access_list",
      plan: "GROWTH",
      members: 2,
      workspaces: 1,
    });
    const owner = org.members[0]!;
    const teammate = org.members[1]!;
    const workspace = org.workspaces[0]!;

    // Pre-grant teammate access to the workspace
    await ctx.db.insert(WorkspaceAccessTable).values({
      id: "wsa_seed",
      workspaceId: workspace.id,
      userId: teammate.userId,
    });

    ctx.setSession({
      user: { id: owner.userId },
      session: { activeOrganizationId: org.id },
    });

    const res = await ctx.request(
      `/auth/workspaces/${workspace.id}/access`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].userId).toBe(teammate.userId);
  });

  test("POST /auth/workspaces/:id/access grants access to a member", async () => {
    const org = await seedOrg(ctx, {
      id: "org_access_grant",
      plan: "GROWTH",
      members: 2,
      workspaces: 1,
    });
    const owner = org.members[0]!;
    const teammate = org.members[1]!;
    const workspace = org.workspaces[0]!;

    ctx.setSession({
      user: { id: owner.userId },
      session: { activeOrganizationId: org.id },
    });

    const res = await ctx.request(
      `/auth/workspaces/${workspace.id}/access`,
      {
        method: "POST",
        body: JSON.stringify({ userId: teammate.userId }),
      },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.userId).toBe(teammate.userId);

    const row = await ctx.db.query.WorkspaceAccessTable.findFirst({
      where: and(
        eq(WorkspaceAccessTable.workspaceId, workspace.id),
        eq(WorkspaceAccessTable.userId, teammate.userId),
      ),
    });
    expect(row).toBeDefined();
  });

  test("POST same grant a second time is idempotent (200, no duplicate row)", async () => {
    const org = await seedOrg(ctx, {
      id: "org_access_dup",
      plan: "GROWTH",
      members: 2,
      workspaces: 1,
    });
    const owner = org.members[0]!;
    const teammate = org.members[1]!;
    const workspace = org.workspaces[0]!;

    ctx.setSession({
      user: { id: owner.userId },
      session: { activeOrganizationId: org.id },
    });

    const first = await ctx.request(
      `/auth/workspaces/${workspace.id}/access`,
      {
        method: "POST",
        body: JSON.stringify({ userId: teammate.userId }),
      },
    );
    expect(first.status).toBe(201);

    const second = await ctx.request(
      `/auth/workspaces/${workspace.id}/access`,
      {
        method: "POST",
        body: JSON.stringify({ userId: teammate.userId }),
      },
    );
    expect(second.status).toBe(200);

    // Still exactly one access row for this (workspace, user) pair.
    const rows = await ctx.db
      .select()
      .from(WorkspaceAccessTable)
      .where(
        and(
          eq(WorkspaceAccessTable.workspaceId, workspace.id),
          eq(WorkspaceAccessTable.userId, teammate.userId),
        ),
      );
    expect(rows.length).toBe(1);
  });

  test("DELETE /auth/workspaces/:id/access/:userId removes the access row", async () => {
    const org = await seedOrg(ctx, {
      id: "org_access_revoke",
      plan: "GROWTH",
      members: 2,
      workspaces: 1,
    });
    const owner = org.members[0]!;
    const teammate = org.members[1]!;
    const workspace = org.workspaces[0]!;

    await ctx.db.insert(WorkspaceAccessTable).values({
      id: "wsa_to_revoke",
      workspaceId: workspace.id,
      userId: teammate.userId,
    });

    ctx.setSession({
      user: { id: owner.userId },
      session: { activeOrganizationId: org.id },
    });

    const res = await ctx.request(
      `/auth/workspaces/${workspace.id}/access/${teammate.userId}`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(204);

    const gone = await ctx.db.query.WorkspaceAccessTable.findFirst({
      where: and(
        eq(WorkspaceAccessTable.workspaceId, workspace.id),
        eq(WorkspaceAccessTable.userId, teammate.userId),
      ),
    });
    expect(gone).toBeUndefined();
  });
});
