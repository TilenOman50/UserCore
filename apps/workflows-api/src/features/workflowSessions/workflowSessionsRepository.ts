import { and, count, desc, eq, gte } from "drizzle-orm";

import type { Logger } from "@usercore/logger";
import type {
  ExternalSessionSource,
  WorkflowVerificationMode,
} from "@usercore/shared-types";

import type { Database } from "../../db/db";
import { WorkflowSessionTable, WorkflowTable } from "../../db/schema.db";

export const createWorkflowSessionsRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const create = async (data: {
    externalSessionId: string;
    externalSessionSource: ExternalSessionSource;
    workflowId: string;
    customerId: string;
    verificationMode?: WorkflowVerificationMode;
    activeDeviceId?: string;
  }) => {
    const [session] = await db
      .insert(WorkflowSessionTable)
      .values(data)
      .returning();
    return session;
  };

  const findById = async (id: string) => {
    return db.query.WorkflowSessionTable.findFirst({
      where: eq(WorkflowSessionTable.id, id),
    });
  };

  const findByExternalSession = async (data: {
    externalSessionId: string;
    externalSessionSource: ExternalSessionSource;
    workflowId: string;
    customerId: string;
    verificationMode: WorkflowVerificationMode;
  }) => {
    return db.query.WorkflowSessionTable.findFirst({
      where: and(
        eq(WorkflowSessionTable.externalSessionId, data.externalSessionId),
        eq(
          WorkflowSessionTable.externalSessionSource,
          data.externalSessionSource,
        ),
        eq(WorkflowSessionTable.workflowId, data.workflowId),
        eq(WorkflowSessionTable.customerId, data.customerId),
        eq(WorkflowSessionTable.verificationMode, data.verificationMode),
      ),
    });
  };

  const listByCustomer = async (customerId: string) => {
    return db
      .select()
      .from(WorkflowSessionTable)
      .where(eq(WorkflowSessionTable.customerId, customerId))
      .orderBy(desc(WorkflowSessionTable.createdAt));
  };

  const listByWorkspace = async (workspaceId: string) => {
    const rows = await db
      .select({ session: WorkflowSessionTable })
      .from(WorkflowSessionTable)
      .innerJoin(
        WorkflowTable,
        eq(WorkflowSessionTable.workflowId, WorkflowTable.id),
      )
      .where(eq(WorkflowTable.workspaceId, workspaceId))
      .orderBy(desc(WorkflowSessionTable.createdAt));
    return rows.map((r) => r.session);
  };

  // Count sessions whose parent workflow is in the given organization and
  // whose createdAt falls inside the current calendar month. Powers the
  // verifications-per-month hard cap.
  const countForOrganizationCurrentMonth = async (
    organizationId: string,
  ): Promise<number> => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const rows = await db
      .select({ value: count() })
      .from(WorkflowSessionTable)
      .innerJoin(
        WorkflowTable,
        eq(WorkflowSessionTable.workflowId, WorkflowTable.id),
      )
      .where(
        and(
          eq(WorkflowTable.organizationId, organizationId),
          gte(WorkflowSessionTable.createdAt, startOfMonth),
        ),
      );
    return rows[0]?.value ?? 0;
  };

  return {
    create,
    findById,
    findByExternalSession,
    listByCustomer,
    listByWorkspace,
    countForOrganizationCurrentMonth,
  };
};

export type WorkflowSessionsRepository = ReturnType<
  typeof createWorkflowSessionsRepository
>;
