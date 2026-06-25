// Shared seeding helpers for auth-api integration tests. Builds the
// org → users → members → workspace graph that every flow test needs.

import { member, organization, user } from "../../src/db/auth.db";
import { WorkspaceAccessTable, WorkspaceTable } from "../../src/db/schema.db";
import type { TestApp } from "./testApp";

export type SeededMember = {
  userId: string;
  memberId: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member";
};

export type SeededOrg = {
  id: string;
  plan: "STARTER" | "GROWTH" | "ENTERPRISE";
  members: SeededMember[];
  workspaces: { id: string; slug: string; name: string }[];
};

// Default "Member 0" is always an owner; subsequent members default to plain
// member-role unless `memberRoles` overrides per-index.
export const seedOrg = async (
  ctx: TestApp,
  opts: {
    id: string;
    plan: "STARTER" | "GROWTH" | "ENTERPRISE";
    members?: number;
    workspaces?: number;
    memberRoles?: ("owner" | "admin" | "member")[];
    memberNames?: string[];
  },
): Promise<SeededOrg> => {
  await ctx.db.insert(organization).values({
    id: opts.id,
    name: `Org ${opts.id}`,
    slug: opts.id,
    plan: opts.plan,
  });

  const seededMembers: SeededMember[] = [];
  const memberCount = opts.members ?? 0;
  for (let i = 0; i < memberCount; i++) {
    const userId = `user_${opts.id}_${i}`;
    const role =
      opts.memberRoles?.[i] ?? (i === 0 ? "owner" : "member");
    const name = opts.memberNames?.[i] ?? `Member ${i}`;
    const email = `${userId}@example.com`;
    await ctx.db.insert(user).values({
      id: userId,
      name,
      email,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const memberId = `mem_${opts.id}_${i}`;
    await ctx.db.insert(member).values({
      id: memberId,
      organizationId: opts.id,
      userId,
      role,
    });
    seededMembers.push({ userId, memberId, email, name, role });
  }

  const workspaces: { id: string; slug: string; name: string }[] = [];
  const workspaceCount = opts.workspaces ?? 0;
  for (let i = 0; i < workspaceCount; i++) {
    const id = `ws_${opts.id}_${i}`;
    const slug = `ws-${i}`;
    const name = `Workspace ${i}`;
    await ctx.db.insert(WorkspaceTable).values({
      id,
      name,
      slug,
      organizationId: opts.id,
      // Workspace ownerId points to the org's first user (the owner).
      ownerId: `user_${opts.id}_0`,
    });
    workspaces.push({ id, slug, name });
  }

  return {
    id: opts.id,
    plan: opts.plan,
    members: seededMembers,
    workspaces,
  };
};

// Grant a single member explicit access to a workspace. Mirrors what
// memberService.inviteMember does for non-owner roles.
export const grantWorkspaceAccess = async (
  ctx: TestApp,
  opts: { workspaceId: string; userId: string; grantedByMemberId?: string },
) => {
  const id = `wsa_${opts.workspaceId}_${opts.userId}`;
  await ctx.db.insert(WorkspaceAccessTable).values({
    id,
    workspaceId: opts.workspaceId,
    userId: opts.userId,
    createdBy: opts.grantedByMemberId,
  });
  return id;
};
