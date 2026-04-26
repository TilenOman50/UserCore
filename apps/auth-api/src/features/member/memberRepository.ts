import { and, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";

import type { Logger } from "@usercore/logger";

import { member, user } from "../../db/auth.db";
import type { Database } from "../../db/db";
import { WorkspaceAccessTable } from "../../db/schema.db";

export const createMemberRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const findUserByEmail = async (email: string) => {
    return db.query.user.findFirst({
      where: eq(user.email, email.toLowerCase()),
    });
  };

  const findMember = async (userId: string, organizationId: string) => {
    return db.query.member.findFirst({
      where: and(
        eq(member.userId, userId),
        eq(member.organizationId, organizationId),
      ),
    });
  };

  const findMemberById = async (id: string) => {
    return db.query.member.findFirst({
      where: eq(member.id, id),
    });
  };

  const listMembersWithUserByOrganization = async (props: {
    organizationId: string;
    search?: string;
    status?: "active" | "pending";
    role?: string;
    workspaceId?: string;
    page: number;
    limit: number;
  }) => {
    const conditions = [eq(member.organizationId, props.organizationId)];

    if (props.search) {
      const pattern = `%${props.search}%`;
      const searchClause = or(
        ilike(user.name, pattern),
        ilike(user.email, pattern),
      );
      if (searchClause) conditions.push(searchClause);
    }

    if (props.status === "active") {
      conditions.push(eq(user.emailVerified, true));
    } else if (props.status === "pending") {
      conditions.push(eq(user.emailVerified, false));
    }

    if (props.role) {
      conditions.push(eq(member.role, props.role));
    }

    if (props.workspaceId) {
      // Owner/admin members implicitly see all workspaces, so they always
      // match. Member-role members only match if they have an access row.
      const accessExists = exists(
        db
          .select({ one: sql`1` })
          .from(WorkspaceAccessTable)
          .where(
            and(
              eq(WorkspaceAccessTable.userId, user.id),
              eq(WorkspaceAccessTable.workspaceId, props.workspaceId),
            ),
          ),
      );
      const orgManagerOrHasAccess = or(
        inArray(member.role, ["owner", "admin"]),
        accessExists,
      );
      if (orgManagerOrHasAccess) conditions.push(orgManagerOrHasAccess);
    }

    const whereClause = and(...conditions);

    const totalRows = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(whereClause);
    const total = totalRows[0]?.total ?? 0;

    const items = await db
      .select({
        memberId: member.id,
        role: member.role,
        createdAt: member.createdAt,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        emailVerified: user.emailVerified,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(whereClause)
      .orderBy(member.createdAt)
      .limit(props.limit)
      .offset((props.page - 1) * props.limit);

    if (items.length === 0) {
      return { items: [], total };
    }

    const userIds = items.map((m) => m.userId);
    const accessRows = await db
      .select({
        userId: WorkspaceAccessTable.userId,
        workspaceId: WorkspaceAccessTable.workspaceId,
      })
      .from(WorkspaceAccessTable)
      .where(inArray(WorkspaceAccessTable.userId, userIds));

    const accessByUser = new Map<string, string[]>();
    for (const row of accessRows) {
      const list = accessByUser.get(row.userId) ?? [];
      list.push(row.workspaceId);
      accessByUser.set(row.userId, list);
    }

    return {
      items: items.map((m) => ({
        ...m,
        workspaceAccess: accessByUser.get(m.userId) ?? [],
      })),
      total,
    };
  };

  const createUser = async (data: {
    id: string;
    name: string;
    email: string;
  }) => {
    const now = new Date();
    const [created] = await db
      .insert(user)
      .values({
        id: data.id,
        name: data.name,
        email: data.email.toLowerCase(),
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created;
  };

  const createMember = async (data: {
    id: string;
    userId: string;
    organizationId: string;
    role: string;
  }) => {
    const [created] = await db
      .insert(member)
      .values({
        id: data.id,
        userId: data.userId,
        organizationId: data.organizationId,
        role: data.role,
        createdAt: new Date(),
      })
      .returning();
    return created;
  };

  const updateMemberRole = async (id: string, role: string) => {
    const [updated] = await db
      .update(member)
      .set({ role })
      .where(eq(member.id, id))
      .returning();
    return updated;
  };

  const deleteMember = async (id: string) => {
    await db.delete(member).where(eq(member.id, id));
  };

  const deleteUser = async (userId: string) => {
    // Cascading FKs handle session, account, member, workspace_access cleanup.
    await db.delete(user).where(eq(user.id, userId));
  };

  const countOwners = async (organizationId: string) => {
    const rows = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.role, "owner"),
        ),
      );
    return rows.length;
  };

  return {
    findUserByEmail,
    findMember,
    findMemberById,
    listMembersWithUserByOrganization,
    createUser,
    createMember,
    updateMemberRole,
    deleteMember,
    deleteUser,
    countOwners,
  };
};

export type MemberRepository = ReturnType<typeof createMemberRepository>;
