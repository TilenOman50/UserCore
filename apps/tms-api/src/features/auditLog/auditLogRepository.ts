import { desc, eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";

import type { Database } from "../../db/db";
import { AuditLogTable } from "../../db/schema.db";

export const createAuditLogRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const create = async (data: {
    workspaceId: string;
    actorId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }) => {
    const [log] = await db.insert(AuditLogTable).values(data).returning();
    return log;
  };

  const findByWorkspaceId = async (workspaceId: string, limit = 50) => {
    return db
      .select()
      .from(AuditLogTable)
      .where(eq(AuditLogTable.workspaceId, workspaceId))
      .orderBy(desc(AuditLogTable.createdAt))
      .limit(limit);
  };

  return { create, findByWorkspaceId };
};

export type AuditLogRepository = ReturnType<typeof createAuditLogRepository>;
