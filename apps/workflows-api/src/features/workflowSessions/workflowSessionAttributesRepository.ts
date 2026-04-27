import { eq, sql } from "drizzle-orm";

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

  return { batchUpsert, findBySessionId };
};

export type WorkflowSessionAttributesRepository = ReturnType<
  typeof createWorkflowSessionAttributesRepository
>;
