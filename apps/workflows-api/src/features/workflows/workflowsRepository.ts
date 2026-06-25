import { and, count, desc, eq, isNull, ne } from "drizzle-orm";

import type { Logger } from "@usercore/logger";
import type {
  WorkflowBranding,
  WorkflowReason,
  WorkflowType,
  WorkflowVerificationMode,
} from "@usercore/shared-types";

import type { Database } from "../../db/db";
import { WorkflowStepTable, WorkflowTable } from "../../db/schema.db";

export const createWorkflowsRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const create = async (data: {
    workspaceId: string;
    organizationId: string;
    displayName: string;
    type?: WorkflowType;
    verificationMode?: WorkflowVerificationMode;
    isDefault?: boolean;
  }) => {
    const [workflow] = await db.insert(WorkflowTable).values(data).returning();
    return workflow;
  };

  // Default lookups exclude soft-deleted rows. Use findByIdIncludingDeleted
  // when historical data (workflow_session lookups, audit) needs to resolve
  // a workflow that's been removed from the dashboard.
  const findById = async (id: string) => {
    return db.query.WorkflowTable.findFirst({
      where: and(eq(WorkflowTable.id, id), isNull(WorkflowTable.deletedAt)),
    });
  };

  const findByIdIncludingDeleted = async (id: string) => {
    return db.query.WorkflowTable.findFirst({
      where: eq(WorkflowTable.id, id),
    });
  };

  const findByIdWithSteps = async (id: string) => {
    const workflow = await findById(id);
    if (!workflow) return null;
    const steps = await db
      .select()
      .from(WorkflowStepTable)
      .where(eq(WorkflowStepTable.workflowId, id));
    return { ...workflow, steps };
  };

  const findDefaultByWorkspace = async (
    workspaceId: string,
    type: WorkflowType,
  ) => {
    return db.query.WorkflowTable.findFirst({
      where: and(
        eq(WorkflowTable.workspaceId, workspaceId),
        eq(WorkflowTable.type, type),
        eq(WorkflowTable.isDefault, true),
        isNull(WorkflowTable.deletedAt),
      ),
    });
  };

  const findByWorkspace = async (
    workspaceId: string,
    organizationId: string,
  ) => {
    return db
      .select()
      .from(WorkflowTable)
      .where(
        and(
          eq(WorkflowTable.workspaceId, workspaceId),
          eq(WorkflowTable.organizationId, organizationId),
          isNull(WorkflowTable.deletedAt),
        ),
      );
  };

  const findByWorkspacePaginated = async (data: {
    workspaceId: string;
    organizationId: string;
    page: number;
    limit: number;
  }) => {
    const where = and(
      eq(WorkflowTable.workspaceId, data.workspaceId),
      eq(WorkflowTable.organizationId, data.organizationId),
      isNull(WorkflowTable.deletedAt),
    );
    const offset = (data.page - 1) * data.limit;
    const [items, totalRow] = await Promise.all([
      db
        .select()
        .from(WorkflowTable)
        .where(where)
        .orderBy(desc(WorkflowTable.isDefault), desc(WorkflowTable.createdAt))
        .limit(data.limit)
        .offset(offset),
      db.select({ value: count() }).from(WorkflowTable).where(where),
    ]);
    const total = totalRow[0]?.value ?? 0;
    return {
      items,
      total,
      page: data.page,
      limit: data.limit,
      totalPages: Math.max(1, Math.ceil(total / data.limit)),
    };
  };

  const update = async (
    id: string,
    data: Partial<{
      displayName: string;
      description: string | null;
      verificationMode: WorkflowVerificationMode;
      isDefault: boolean;
      branding: WorkflowBranding;
    }>,
  ) => {
    const [workflow] = await db
      .update(WorkflowTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(WorkflowTable.id, id))
      .returning();
    return workflow;
  };

  const updateValidity = async (
    id: string,
    valid: boolean,
    reasons: WorkflowReason[],
  ) => {
    const [workflow] = await db
      .update(WorkflowTable)
      .set({ valid, reasons, updatedAt: new Date() })
      .where(eq(WorkflowTable.id, id))
      .returning();
    return workflow;
  };

  // Demote any other default workflow for the same (workspace, type) — used
  // before promoting a new default so the unique partial index doesn't reject
  // the write. `exceptId` skips the workflow about to be promoted (a no-op for
  // create, the target id for update).
  const clearDefaultsFor = async (
    workspaceId: string,
    type: WorkflowType,
    exceptId?: string,
  ) => {
    const conds = [
      eq(WorkflowTable.workspaceId, workspaceId),
      eq(WorkflowTable.type, type),
      eq(WorkflowTable.isDefault, true),
      isNull(WorkflowTable.deletedAt),
    ];
    if (exceptId) conds.push(ne(WorkflowTable.id, exceptId));
    await db
      .update(WorkflowTable)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(...conds));
  };

  // Soft delete — sets deletedAt. The row stays so existing
  // workflow_session FKs continue to resolve and the audit trail is intact.
  const remove = async (id: string) => {
    const now = new Date();
    await db
      .update(WorkflowTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(WorkflowTable.id, id));
  };

  return {
    create,
    findById,
    findByIdIncludingDeleted,
    findByIdWithSteps,
    findDefaultByWorkspace,
    findByWorkspace,
    findByWorkspacePaginated,
    update,
    updateValidity,
    clearDefaultsFor,
    remove,
  };
};

export type WorkflowsRepository = ReturnType<typeof createWorkflowsRepository>;
