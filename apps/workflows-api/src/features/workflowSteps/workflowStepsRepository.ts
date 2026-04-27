import { and, eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";
import type {
  ProviderShortName,
  WorkflowStepType,
} from "@usercore/shared-types";

import type { Database } from "../../db/db";
import { WorkflowStepTable } from "../../db/schema.db";

export const createWorkflowStepsRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const create = async (data: {
    workflowId: string;
    type: WorkflowStepType;
    provider?: ProviderShortName | null;
    valid?: boolean;
  }) => {
    const [step] = await db
      .insert(WorkflowStepTable)
      .values({
        workflowId: data.workflowId,
        type: data.type,
        provider: data.provider ?? null,
        valid: data.valid ?? false,
      })
      .returning();
    return step;
  };

  const findById = async (id: string) => {
    return db.query.WorkflowStepTable.findFirst({
      where: eq(WorkflowStepTable.id, id),
    });
  };

  const findByWorkflowId = async (workflowId: string) => {
    return db
      .select()
      .from(WorkflowStepTable)
      .where(eq(WorkflowStepTable.workflowId, workflowId));
  };

  const findByWorkflowAndType = async (
    workflowId: string,
    type: WorkflowStepType,
  ) => {
    return db.query.WorkflowStepTable.findFirst({
      where: and(
        eq(WorkflowStepTable.workflowId, workflowId),
        eq(WorkflowStepTable.type, type),
      ),
    });
  };

  const update = async (
    id: string,
    data: Partial<{
      provider: ProviderShortName | null;
      valid: boolean;
    }>,
  ) => {
    const [step] = await db
      .update(WorkflowStepTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(WorkflowStepTable.id, id))
      .returning();
    return step;
  };

  const remove = async (id: string) => {
    await db.delete(WorkflowStepTable).where(eq(WorkflowStepTable.id, id));
  };

  return {
    create,
    findById,
    findByWorkflowId,
    findByWorkflowAndType,
    update,
    remove,
  };
};

export type WorkflowStepsRepository = ReturnType<
  typeof createWorkflowStepsRepository
>;
