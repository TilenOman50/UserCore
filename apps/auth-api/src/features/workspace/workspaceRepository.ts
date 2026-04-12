import { eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";

import type { Database } from "../../db/db";
import { WorkspaceTable } from "../../db/schema.db";

export const createWorkspaceRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const findById = async (id: string) => {
    return db.query.WorkspaceTable.findFirst({
      where: eq(WorkspaceTable.id, id),
    });
  };

  const findByOrganizationId = async (organizationId: string) => {
    return db
      .select()
      .from(WorkspaceTable)
      .where(eq(WorkspaceTable.organizationId, organizationId));
  };

  const create = async (data: {
    name: string;
    slug: string;
    organizationId: string;
    ownerId: string;
  }) => {
    const [workspace] = await db
      .insert(WorkspaceTable)
      .values(data)
      .returning();
    return workspace;
  };

  return { findById, findByOrganizationId, create };
};

export type WorkspaceRepository = ReturnType<typeof createWorkspaceRepository>;
