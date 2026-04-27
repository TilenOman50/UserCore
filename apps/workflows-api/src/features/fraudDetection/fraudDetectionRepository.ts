import { eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";

import type { Database } from "../../db/db";
import { FraudDetectionStepTable } from "../../db/schema.db";

export const createFraudDetectionRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const create = async (data: {
    workflowStepId: string;
    screenOnCreated?: boolean;
  }) => {
    const [step] = await db
      .insert(FraudDetectionStepTable)
      .values({
        workflowStepId: data.workflowStepId,
        screenOnCreated: data.screenOnCreated ?? true,
      })
      .returning();
    return step;
  };

  const findByWorkflowStepId = async (workflowStepId: string) => {
    return db.query.FraudDetectionStepTable.findFirst({
      where: eq(FraudDetectionStepTable.workflowStepId, workflowStepId),
    });
  };

  const update = async (
    workflowStepId: string,
    data: Partial<{
      screenOnCreated: boolean;
      providerConfig: unknown;
    }>,
  ) => {
    const [step] = await db
      .update(FraudDetectionStepTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(FraudDetectionStepTable.workflowStepId, workflowStepId))
      .returning();
    return step;
  };

  return { create, findByWorkflowStepId, update };
};

export type FraudDetectionRepository = ReturnType<
  typeof createFraudDetectionRepository
>;
