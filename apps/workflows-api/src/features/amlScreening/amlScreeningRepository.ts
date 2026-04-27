import { eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";

import type { Database } from "../../db/db";
import { AmlScreeningStepTable } from "../../db/schema.db";

export const createAmlScreeningRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const create = async (data: {
    workflowStepId: string;
    screenOnCreated?: boolean;
    monitorOngoing?: boolean;
  }) => {
    const [step] = await db
      .insert(AmlScreeningStepTable)
      .values({
        workflowStepId: data.workflowStepId,
        screenOnCreated: data.screenOnCreated ?? true,
        monitorOngoing: data.monitorOngoing ?? false,
      })
      .returning();
    return step;
  };

  const findByWorkflowStepId = async (workflowStepId: string) => {
    return db.query.AmlScreeningStepTable.findFirst({
      where: eq(AmlScreeningStepTable.workflowStepId, workflowStepId),
    });
  };

  const update = async (
    workflowStepId: string,
    data: Partial<{
      screenOnCreated: boolean;
      monitorOngoing: boolean;
      providerConfig: unknown;
    }>,
  ) => {
    const [step] = await db
      .update(AmlScreeningStepTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(AmlScreeningStepTable.workflowStepId, workflowStepId))
      .returning();
    return step;
  };

  return { create, findByWorkflowStepId, update };
};

export type AmlScreeningRepository = ReturnType<
  typeof createAmlScreeningRepository
>;
