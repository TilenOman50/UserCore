import { and, eq, inArray, sql } from "drizzle-orm";

import type { Logger } from "@usercore/logger";
import type {
  WorkflowSessionStatus,
  WorkflowSessionStepType,
} from "@usercore/shared-types";

import type { Database } from "../../db/db";
import { WorkflowSessionStepTable } from "../../db/schema.db";

export const createWorkflowSessionStepsRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  // Insert-or-update on (sessionId, step). Used by provider webhook handlers
  // and the manual review page so multiple status transitions per step
  // collapse to one row that holds the latest status.
  const upsert = async (data: {
    sessionId: string;
    step: WorkflowSessionStepType;
    status: WorkflowSessionStatus;
    message?: string | null;
    traceId?: string | null;
    parentStepId?: string | null;
  }) => {
    const [row] = await db
      .insert(WorkflowSessionStepTable)
      .values({
        sessionId: data.sessionId,
        step: data.step,
        status: data.status,
        message: data.message ?? null,
        traceId: data.traceId ?? null,
        parentStepId: data.parentStepId ?? null,
      })
      .onConflictDoUpdate({
        target: [
          WorkflowSessionStepTable.sessionId,
          WorkflowSessionStepTable.step,
        ],
        set: {
          status: data.status,
          message: data.message ?? null,
          traceId: data.traceId ?? null,
          parentStepId: data.parentStepId ?? null,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return row;
  };

  const findBySessionId = async (sessionId: string) => {
    return db
      .select()
      .from(WorkflowSessionStepTable)
      .where(eq(WorkflowSessionStepTable.sessionId, sessionId));
  };

  const findBySessionAndStep = async (
    sessionId: string,
    step: WorkflowSessionStepType,
  ) => {
    return db.query.WorkflowSessionStepTable.findFirst({
      where: and(
        eq(WorkflowSessionStepTable.sessionId, sessionId),
        eq(WorkflowSessionStepTable.step, step),
      ),
    });
  };

  // Remove step rows — used to reset a manual scan's verdict (id-scan /
  // face-scan) when a reviewer bounces it back, so a prior Approve/Reject
  // doesn't carry over onto the customer's new submission.
  const deleteBySessionAndSteps = async (
    sessionId: string,
    steps: string[],
  ) => {
    if (steps.length === 0) return;
    await db.delete(WorkflowSessionStepTable).where(
      and(
        eq(WorkflowSessionStepTable.sessionId, sessionId),
        // Callers pass plain strings; the column is the step enum.
        inArray(
          WorkflowSessionStepTable.step,
          steps as WorkflowSessionStepType[],
        ),
      ),
    );
  };

  return {
    upsert,
    findBySessionId,
    findBySessionAndStep,
    deleteBySessionAndSteps,
  };
};

export type WorkflowSessionStepsRepository = ReturnType<
  typeof createWorkflowSessionStepsRepository
>;
