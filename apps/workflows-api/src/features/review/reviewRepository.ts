import { eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";

import type { Database } from "../../db/db";
import { KycReviewTable } from "../../db/schema.db";

export const createReviewRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const create = async (data: {
    kycSessionId: string;
    reviewedBy: string;
    decision: "approved" | "rejected";
    reason?: string;
  }) => {
    const [review] = await db.insert(KycReviewTable).values(data).returning();
    return review;
  };

  const findBySessionId = async (kycSessionId: string) => {
    return db.query.KycReviewTable.findFirst({
      where: eq(KycReviewTable.kycSessionId, kycSessionId),
    });
  };

  return { create, findBySessionId };
};

export type ReviewRepository = ReturnType<typeof createReviewRepository>;
