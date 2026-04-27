import { and, eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";
import {
  IDENTITY_VERIFICATION_SUB_STEP_TYPES,
  type IdentityVerificationSubStepType,
} from "@usercore/shared-types";

import type { Database } from "../../db/db";
import {
  IdentityVerificationStepTable,
  IdentityVerificationSubStepTable,
} from "../../db/schema.db";

export const createIdentityVerificationRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const createStepWithSubSteps = async (workflowStepId: string) => {
    return db.transaction(async (tx) => {
      const [step] = await tx
        .insert(IdentityVerificationStepTable)
        .values({ workflowStepId })
        .returning();

      const subStepRows = IDENTITY_VERIFICATION_SUB_STEP_TYPES.map((type) => ({
        type,
        enabled: false,
        valid: false,
        identityVerificationStepId: step!.id,
      }));
      const subSteps = await tx
        .insert(IdentityVerificationSubStepTable)
        .values(subStepRows)
        .returning();

      return { step: step!, subSteps };
    });
  };

  const findById = async (id: string) => {
    return db.query.IdentityVerificationStepTable.findFirst({
      where: eq(IdentityVerificationStepTable.id, id),
    });
  };

  const findByWorkflowStepId = async (workflowStepId: string) => {
    return db.query.IdentityVerificationStepTable.findFirst({
      where: eq(IdentityVerificationStepTable.workflowStepId, workflowStepId),
    });
  };

  const findSubStepsByStepId = async (identityVerificationStepId: string) => {
    return db
      .select()
      .from(IdentityVerificationSubStepTable)
      .where(
        eq(
          IdentityVerificationSubStepTable.identityVerificationStepId,
          identityVerificationStepId,
        ),
      );
  };

  const findSubStepById = async (id: string) => {
    return db.query.IdentityVerificationSubStepTable.findFirst({
      where: eq(IdentityVerificationSubStepTable.id, id),
    });
  };

  const findSubStepByType = async (
    identityVerificationStepId: string,
    type: IdentityVerificationSubStepType,
  ) => {
    return db.query.IdentityVerificationSubStepTable.findFirst({
      where: and(
        eq(
          IdentityVerificationSubStepTable.identityVerificationStepId,
          identityVerificationStepId,
        ),
        eq(IdentityVerificationSubStepTable.type, type),
      ),
    });
  };

  const updateSubStep = async (
    id: string,
    data: Partial<{
      enabled: boolean;
      valid: boolean;
      providerConfig: unknown;
    }>,
  ) => {
    const [subStep] = await db
      .update(IdentityVerificationSubStepTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(IdentityVerificationSubStepTable.id, id))
      .returning();
    return subStep;
  };

  const deleteByWorkflowStepId = async (workflowStepId: string) => {
    await db
      .delete(IdentityVerificationStepTable)
      .where(eq(IdentityVerificationStepTable.workflowStepId, workflowStepId));
  };

  return {
    createStepWithSubSteps,
    findById,
    findByWorkflowStepId,
    findSubStepsByStepId,
    findSubStepById,
    findSubStepByType,
    updateSubStep,
    deleteByWorkflowStepId,
  };
};

export type IdentityVerificationRepository = ReturnType<
  typeof createIdentityVerificationRepository
>;
