import { eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";

import type { Database } from "../../db/db";
import { WorkspaceSettingsTable } from "../../db/schema.db";

export const createWorkspaceRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const findSettingsByWorkspaceId = async (workspaceId: string) => {
    return db.query.WorkspaceSettingsTable.findFirst({
      where: eq(WorkspaceSettingsTable.workspaceId, workspaceId),
    });
  };

  const upsertSettings = async (data: {
    workspaceId: string;
    displayName?: string;
    logoUrl?: string;
    primaryColor?: string;
  }) => {
    const [settings] = await db
      .insert(WorkspaceSettingsTable)
      .values(data)
      .onConflictDoUpdate({
        target: WorkspaceSettingsTable.workspaceId,
        set: {
          displayName: data.displayName,
          logoUrl: data.logoUrl,
          primaryColor: data.primaryColor,
          updatedAt: new Date(),
        },
      })
      .returning();
    return settings;
  };

  return { findSettingsByWorkspaceId, upsertSettings };
};

export type WorkspaceRepository = ReturnType<typeof createWorkspaceRepository>;
