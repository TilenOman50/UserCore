import { eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";

import type { Database } from "../../db/db";
import { DuplicateDetectionStepTable } from "../../db/schema.db";

export const createDuplicateDetectionRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const create = async (workflowStepId: string) => {
    const [step] = await db
      .insert(DuplicateDetectionStepTable)
      .values({ workflowStepId })
      .returning();
    return step;
  };

  const findByWorkflowStepId = async (workflowStepId: string) => {
    return db.query.DuplicateDetectionStepTable.findFirst({
      where: eq(DuplicateDetectionStepTable.workflowStepId, workflowStepId),
    });
  };

  return { create, findByWorkflowStepId };
};

export type DuplicateDetectionRepository = ReturnType<
  typeof createDuplicateDetectionRepository
>;
