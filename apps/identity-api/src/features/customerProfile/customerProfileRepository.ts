import { eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";
import type { KycStatus } from "@usercore/shared-types";

import type { Database } from "../../db/db";
import { CustomerProfileTable } from "../../db/schema.db";

export const createCustomerProfileRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const findByCustomerId = async (customerId: string) => {
    return db.query.CustomerProfileTable.findFirst({
      where: eq(CustomerProfileTable.customerId, customerId),
    });
  };

  const findByWorkspaceId = async (workspaceId: string) => {
    return db
      .select()
      .from(CustomerProfileTable)
      .where(eq(CustomerProfileTable.workspaceId, workspaceId));
  };

  const create = async (data: {
    customerId: string;
    workspaceId: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    nationality?: string;
    address?: string;
    city?: string;
    country?: string;
  }) => {
    const [profile] = await db
      .insert(CustomerProfileTable)
      .values(data)
      .returning();
    return profile;
  };

  const update = async (
    customerId: string,
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
      .update(CustomerProfileTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(CustomerProfileTable.customerId, customerId))
      .returning();
    return profile;
  };

  const updateKycStatus = async (props: {
    customerId: string;
    kycStatus: KycStatus;
    kycSessionId?: string;
    kycCompletedAt?: Date;
  }) => {
    const [profile] = await db
      .update(CustomerProfileTable)
      .set({
        kycStatus: props.kycStatus,
        kycSessionId: props.kycSessionId,
        kycCompletedAt: props.kycCompletedAt,
        updatedAt: new Date(),
      })
      .where(eq(CustomerProfileTable.customerId, props.customerId))
      .returning();
    return profile;
  };

  return {
    findByCustomerId,
    findByWorkspaceId,
    create,
    update,
    updateKycStatus,
  };
};

export type CustomerProfileRepository = ReturnType<
  typeof createCustomerProfileRepository
>;
