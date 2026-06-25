// Workspace lifecycle: create / rename / delete. Owners and admins can
// create + rename; only owners can delete. Deletes emit a
// workspace.deleted RabbitMQ event for sister services (workflows-api,
// dashboard-api) to react to.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { WorkspaceTable } from "../src/db/schema.db";
import { seedOrg } from "./utils/seed";
import { bootTestApp, type TestApp } from "./utils/testApp";

describe("Workspace lifecycle", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("POST /auth/workspaces/create as an owner creates the workspace + auto-slug", async () => {
    const org = await seedOrg(ctx, {
      id: "org_ws_create",
      plan: "GROWTH",
      members: 1,
    });
    const owner = org.members[0]!;

    ctx.setSession({
      user: { id: owner.userId, name: "Owner", email: owner.email },
      session: { activeOrganizationId: org.id },
    });

    const res = await ctx.request("/auth/workspaces/create", {
      method: "POST",
      body: JSON.stringify({ name: "My New Workspace" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.workspace.name).toBe("My New Workspace");
    expect(body.workspace.slug).toBe("my-new-workspace");
    expect(body.workspace.organizationId).toBe(org.id);

    // Confirm the row landed with the correct ownerId pointing to the caller.
    const row = await ctx.db.query.WorkspaceTable.findFirst({
      where: eq(WorkspaceTable.id, body.workspace.id),
    });
    expect(row?.ownerId).toBe(owner.userId);
  });

  test("POST /auth/workspaces/create as a member-role caller returns 403", async () => {
    const org = await seedOrg(ctx, {
      id: "org_ws_member",
      plan: "GROWTH",
      members: 2,
      // Member 0 = owner (default), Member 1 = plain member
    });
    const plainMember = org.members[1]!;

    ctx.setSession({
      user: { id: plainMember.userId, email: plainMember.email },
      session: { activeOrganizationId: org.id },
    });

    const res = await ctx.request("/auth/workspaces/create", {
      method: "POST",
      body: JSON.stringify({ name: "Should Not Exist" }),
    });
    expect(res.status).toBe(403);
  });

  test("PATCH /auth/workspaces/:id rename by owner updates name + slug", async () => {
    const org = await seedOrg(ctx, {
      id: "org_ws_rename",
      plan: "GROWTH",
      members: 1,
      workspaces: 1,
    });
    const owner = org.members[0]!;
    const workspace = org.workspaces[0]!;

    ctx.setSession({
      user: { id: owner.userId },
      session: { activeOrganizationId: org.id },
    });

    const res = await ctx.request(`/auth/workspaces/${workspace.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed Workspace" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspace.name).toBe("Renamed Workspace");
    expect(body.workspace.slug).toBe("renamed-workspace");
  });

  test("PATCH /auth/workspaces/:id by a non-member of the org returns 403", async () => {
    // Workspace lives in org A; caller is owner of unrelated org B.
    const orgA = await seedOrg(ctx, {
      id: "org_ws_other",
      plan: "GROWTH",
      members: 1,
      workspaces: 1,
    });
    const orgB = await seedOrg(ctx, {
      id: "org_outsider",
      plan: "STARTER",
      members: 1,
    });
    const outsider = orgB.members[0]!;
    const targetWorkspace = orgA.workspaces[0]!;

    ctx.setSession({
      user: { id: outsider.userId },
      session: { activeOrganizationId: orgB.id },
    });

    const res = await ctx.request(`/auth/workspaces/${targetWorkspace.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Hijacked" }),
    });
    expect(res.status).toBe(403);
  });

  test("DELETE /auth/workspaces/:id by owner removes it + emits workspace.deleted event", async () => {
    // Need 2 workspaces — the route refuses to delete an org's last one.
    const org = await seedOrg(ctx, {
      id: "org_ws_delete",
      plan: "GROWTH",
      members: 1,
      workspaces: 2,
    });
    const owner = org.members[0]!;
    const target = org.workspaces[0]!;

    ctx.setSession({
      user: { id: owner.userId },
      session: { activeOrganizationId: org.id },
    });

    const res = await ctx.request(`/auth/workspaces/${target.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);

    const gone = await ctx.db.query.WorkspaceTable.findFirst({
      where: eq(WorkspaceTable.id, target.id),
    });
    expect(gone).toBeUndefined();

    const event = ctx.rabbit.published.find(
      (e) => e.routingKey === "workspace.deleted",
    );
    expect(event).toBeDefined();
    expect((event!.payload as { workspaceId: string }).workspaceId).toBe(
      target.id,
    );
  });
});
