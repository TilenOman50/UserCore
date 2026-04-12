import { eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";
import type { KycStatus } from "@usercore/shared-types";

import type { Database } from "../../db/db";
import { UserProfileTable } from "../../db/schema.db";

export const createUserProfileRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const findByUserId = async (userId: string) => {
    return db.query.UserProfileTable.findFirst({
      where: eq(UserProfileTable.userId, userId),
    });
  };

  const findByWorkspaceId = async (workspaceId: string) => {
    return db
      .select()
      .from(UserProfileTable)
      .where(eq(UserProfileTable.workspaceId, workspaceId));
  };

  const create = async (data: {
    userId: string;
    workspaceId: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    nationality?: string;
    address?: string;
    city?: string;
    country?: string;
  }) => {
    const [profile] = await db.insert(UserProfileTable).values(data).returning();
    return profile;
  };

  const update = async (
    userId: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      nationality: string;
      address: string;
      city: string;
      country: string;
    }>,
  ) => {
    const [profile] = await db
      .update(UserProfileTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(UserProfileTable.userId, userId))
      .returning();
    return profile;
  };

  const updateKycStatus = async (props: {
    userId: string;
    kycStatus: KycStatus;
    kycSessionId?: string;
    kycCompletedAt?: Date;
  }) => {
    const [profile] = await db
      .update(UserProfileTable)
      .set({
        kycStatus: props.kycStatus,
        kycSessionId: props.kycSessionId,
        kycCompletedAt: props.kycCompletedAt,
        updatedAt: new Date(),
      })
      .where(eq(UserProfileTable.userId, props.userId))
      .returning();
    return profile;
  };

  return { findByUserId, findByWorkspaceId, create, update, updateKycStatus };
};

export type UserProfileRepository = ReturnType<typeof createUserProfileRepository>;
