import { eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";

import type { Database } from "../../db/db";
import { LivenessCheckTable } from "../../db/schema.db";

export const createLivenessRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const create = async (data: {
    kycSessionId: string;
    passed: boolean;
    confidence?: string;
    checks?: string[];
  }) => {
    const [check] = await db
      .insert(LivenessCheckTable)
      .values(data)
      .returning();
    return check;
  };

  const findBySessionId = async (kycSessionId: string) => {
    return db.query.LivenessCheckTable.findFirst({
      where: eq(LivenessCheckTable.kycSessionId, kycSessionId),
    });
  };

  return { create, findBySessionId };
};

export type LivenessRepository = ReturnType<typeof createLivenessRepository>;
