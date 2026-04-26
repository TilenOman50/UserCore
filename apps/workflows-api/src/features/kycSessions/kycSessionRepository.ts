import { eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";

import type { Database } from "../../db/db";
import { KycSessionTable } from "../../db/schema.db";

export const createKycSessionRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const findById = async (id: string) => {
    return db.query.KycSessionTable.findFirst({
      where: eq(KycSessionTable.id, id),
    });
  };

  const findByCustomerId = async (customerId: string) => {
    return db.query.KycSessionTable.findFirst({
      where: eq(KycSessionTable.customerId, customerId),
    });
  };

  const findByWorkspaceId = async (workspaceId: string) => {
    return db
      .select()
      .from(KycSessionTable)
      .where(eq(KycSessionTable.workspaceId, workspaceId));
  };

  const create = async (data: { customerId: string; workspaceId: string }) => {
    const [session] = await db.insert(KycSessionTable).values(data).returning();
    return session;
  };

  const updateFormData = async (
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      nationality?: string;
      address?: string;
      city?: string;
      country?: string;
      status?: typeof KycSessionTable.$inferInsert.status;
    },
  ) => {
    const [session] = await db
      .update(KycSessionTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(KycSessionTable.id, id))
      .returning();
    return session;
  };

  const updateStatus = async (
    id: string,
    status: typeof KycSessionTable.$inferInsert.status,
  ) => {
    const [session] = await db
      .update(KycSessionTable)
      .set({
        status,
        submittedAt: status === "submitted" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(KycSessionTable.id, id))
      .returning();
    return session;
  };

  return {
    findById,
    findByCustomerId,
    findByWorkspaceId,
    create,
    updateFormData,
    updateStatus,
  };
};

export type KycSessionRepository = ReturnType<
  typeof createKycSessionRepository
>;
