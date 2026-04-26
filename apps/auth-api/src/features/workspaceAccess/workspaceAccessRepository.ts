import { and, eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";

import { user } from "../../db/auth.db";
import type { Database } from "../../db/db";
import { WorkspaceAccessTable } from "../../db/schema.db";

export const createWorkspaceAccessRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const listAccessForWorkspace = async (workspaceId: string) => {
    return db
      .select({
        id: WorkspaceAccessTable.id,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        createdAt: WorkspaceAccessTable.createdAt,
      })
      .from(WorkspaceAccessTable)
      .innerJoin(user, eq(user.id, WorkspaceAccessTable.userId))
      .where(eq(WorkspaceAccessTable.workspaceId, workspaceId));
  };

  const grantAccess = async (data: {
    id: string;
    workspaceId: string;
    userId: string;
    createdBy?: string;
  }) => {
    const now = new Date();
    const [created] = await db
      .insert(WorkspaceAccessTable)
      .values({
        id: data.id,
        workspaceId: data.workspaceId,
        userId: data.userId,
        createdBy: data.createdBy,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning();
    return created ?? null;
  };

  const revokeAccess = async (workspaceId: string, userId: string) => {
    await db
      .delete(WorkspaceAccessTable)
      .where(
        and(
          eq(WorkspaceAccessTable.workspaceId, workspaceId),
          eq(WorkspaceAccessTable.userId, userId),
        ),
      );
  };

  return { listAccessForWorkspace, grantAccess, revokeAccess };
};

export type WorkspaceAccessRepository = ReturnType<
  typeof createWorkspaceAccessRepository
>;
