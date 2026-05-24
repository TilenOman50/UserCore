import { and, eq, inArray, sql } from "drizzle-orm";

import type { Logger } from "@usercore/logger";
import type { AttributeType } from "@usercore/shared-types";

import type { Database } from "../../db/db";
import { WorkflowSessionAttributeTable } from "../../db/schema.db";

export type AttributeUpsert = {
  attribute: string;
  value: string;
  attributeType: AttributeType;
};

export const createWorkflowSessionAttributesRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  // Batch insert-or-update of EAV rows on (workflowSessionId, attribute).
  // Single statement so a webhook payload writes all its derived attributes
  // atomically.
  const batchUpsert = async (data: {
    workflowSessionId: string;
    attributes: AttributeUpsert[];
  }) => {
    if (data.attributes.length === 0) return [];
    const rows = data.attributes.map((a) => ({
      workflowSessionId: data.workflowSessionId,
      attribute: a.attribute,
      value: a.value,
      attributeType: a.attributeType,
    }));
    return db
      .insert(WorkflowSessionAttributeTable)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          WorkflowSessionAttributeTable.workflowSessionId,
          WorkflowSessionAttributeTable.attribute,
        ],
        set: {
          value: sql`excluded.value`,
          attributeType: sql`excluded.attribute_type`,
          updatedAt: sql`now()`,
        },
      })
      .returning();
  };

  const findBySessionId = async (workflowSessionId: string) => {
    return db
      .select()
      .from(WorkflowSessionAttributeTable)
      .where(
        eq(WorkflowSessionAttributeTable.workflowSessionId, workflowSessionId),
      );
  };

  // Remove specific EAV rows — used to wipe a step's captured data when a
  // reviewer bounces it back for resubmission, so the customer's new submission
  // doesn't merge with stale values from the first attempt.
  const deleteByAttributes = async (data: {
    workflowSessionId: string;
    attributes: string[];
  }) => {
    if (data.attributes.length === 0) return;
    await db
      .delete(WorkflowSessionAttributeTable)
      .where(
        and(
          eq(
            WorkflowSessionAttributeTable.workflowSessionId,
            data.workflowSessionId,
          ),
          inArray(WorkflowSessionAttributeTable.attribute, data.attributes),
        ),
      );
  };

  return { batchUpsert, findBySessionId, deleteByAttributes };
};

export type WorkflowSessionAttributesRepository = ReturnType<
  typeof createWorkflowSessionAttributesRepository
>;
