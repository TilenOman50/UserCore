import { eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";

import type { Database } from "../../db/db";
import { IdentityWidgetTable } from "../../db/schema.db";

export type IdentityWidgetUpdate = Partial<{
  name: string | null;
  logoS3ObjectKey: string | null;
  coverS3ObjectKey: string | null;
  showCoverImage: boolean;
  brandingMainColor: string | null;
  brandingCtaColor: string | null;
  brandingSecondaryColor: string | null;
  bottomContentTitle: string | null;
  bottomContentLink: string | null;
  bottomContentDescription: string | null;
  hosts: string[];
}>;

export const createIdentityWidgetRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const create = async (data: { workflowId: string }) => {
    const [widget] = await db
      .insert(IdentityWidgetTable)
      .values({ workflowId: data.workflowId, hosts: [] })
      .returning();
    return widget;
  };

  const findByWorkflowId = async (workflowId: string) => {
    return db.query.IdentityWidgetTable.findFirst({
      where: eq(IdentityWidgetTable.workflowId, workflowId),
    });
  };

  const update = async (workflowId: string, data: IdentityWidgetUpdate) => {
    const [widget] = await db
      .update(IdentityWidgetTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(IdentityWidgetTable.workflowId, workflowId))
      .returning();
    return widget;
  };

  const remove = async (workflowId: string) => {
    await db
      .delete(IdentityWidgetTable)
      .where(eq(IdentityWidgetTable.workflowId, workflowId));
  };

  return { create, findByWorkflowId, update, remove };
};

export type IdentityWidgetRepository = ReturnType<
  typeof createIdentityWidgetRepository
>;
