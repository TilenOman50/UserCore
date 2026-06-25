// Member management: list / search / invite / promote. Invitations create
// a backing user + member row and dispatch an email; promoting the last
// owner-to-non-owner is rejected to keep every org with at least one owner.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { member, user } from "../src/db/auth.db";
import { seedOrg } from "./utils/seed";
import { bootTestApp, type TestApp } from "./utils/testApp";

describe("Members", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("GET /auth/members lists members of the org for an owner", async () => {
    const org = await seedOrg(ctx, {
      id: "org_members_list",
      plan: "GROWTH",
      members: 3,
    });
    const owner = org.members[0]!;
    ctx.setSession({
      user: { id: owner.userId },
      session: { activeOrganizationId: org.id },
    });

    const res = await ctx.request(
      `/auth/members?organizationId=${org.id}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.items.length).toBe(3);
  });

  test("GET /auth/members filters by ?q= (name/email substring)", async () => {
    const org = await seedOrg(ctx, {
      id: "org_members_search",
      plan: "GROWTH",
      members: 3,
      memberNames: ["Marko Polo", "Janez Novak", "Ana Horvat"],
    });
    const owner = org.members[0]!;
    ctx.setSession({
      user: { id: owner.userId },
      session: { activeOrganizationId: org.id },
    });

    const res = await ctx.request(
      `/auth/members?organizationId=${org.id}&q=Marko`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].userName).toBe("Marko Polo");
  });

  test("POST /auth/members/invite creates user + member rows and sends an email", async () => {
    const org = await seedOrg(ctx, {
      id: "org_members_invite",
      plan: "GROWTH",
      members: 1,
      workspaces: 1,
    });
    const owner = org.members[0]!;
    ctx.setSession({
      user: { id: owner.userId, name: "Owner Person" },
      session: { activeOrganizationId: org.id },
    });

    const res = await ctx.request("/auth/members/invite", {
      method: "POST",
      body: JSON.stringify({
        organizationId: org.id,
        email: "newbie@example.com",
        role: "member",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.memberId).toBeTruthy();
    expect(body.userId).toBeTruthy();

    // User row was created
    const createdUser = await ctx.db.query.user.findFirst({
      where: eq(user.email, "newbie@example.com"),
    });
    expect(createdUser).toBeDefined();

    // Email was dispatched via the fake mailer
    const invite = ctx.mailer.sent.find(
      (m) => m.kind === "invitation" && m.to === "newbie@example.com",
    );
    expect(invite).toBeDefined();
  });

  test("POST /auth/members/invite for an already-existing member returns 409", async () => {
    const org = await seedOrg(ctx, {
      id: "org_members_dup",
      plan: "GROWTH",
      members: 2,
    });
    const owner = org.members[0]!;
    const existing = org.members[1]!;
    ctx.setSession({
      user: { id: owner.userId },
      session: { activeOrganizationId: org.id },
    });

    const res = await ctx.request("/auth/members/invite", {
      method: "POST",
      body: JSON.stringify({
        organizationId: org.id,
        email: existing.email,
        role: "member",
      }),
    });
    expect(res.status).toBe(409);
  });

  test("PATCH /auth/members/:id/role promotes a member; demoting the last owner is rejected", async () => {
    const org = await seedOrg(ctx, {
      id: "org_members_promote",
      plan: "GROWTH",
      members: 2,
    });
    const owner = org.members[0]!;
    const promotee = org.members[1]!;
    ctx.setSession({
      user: { id: owner.userId },
      session: { activeOrganizationId: org.id },
    });

    // Promote the plain member up to admin — should succeed.
    const promote = await ctx.request(
      `/auth/members/${promotee.memberId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ organizationId: org.id, role: "admin" }),
      },
    );
    expect(promote.status).toBe(200);
    const promoteBody = await promote.json();
    expect(promoteBody.role).toBe("admin");

    // Try to demote the sole owner → should be rejected (status 403 from the
    // service-level "last owner" guard).
    const demoteRes = await ctx.request(
      `/auth/members/${owner.memberId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ organizationId: org.id, role: "member" }),
      },
    );
    expect(demoteRes.status).toBe(403);

    // Confirm the DB still shows the owner as owner.
    const stillOwner = await ctx.db.query.member.findFirst({
      where: eq(member.id, owner.memberId),
    });
    expect(stillOwner?.role).toBe("owner");
  });
});
