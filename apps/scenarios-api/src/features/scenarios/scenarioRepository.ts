import { eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";
import type {
  ScenarioActionConfig,
  ScenarioEvaluation,
} from "@usercore/shared-types";
import { emptyEvaluation } from "@usercore/shared-types";

import type { Database } from "../../db/db";
import { ScenarioTable } from "../../db/schema.db";

export const createScenarioRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const findById = async (id: string) => {
    return db.query.ScenarioTable.findFirst({
      where: eq(ScenarioTable.id, id),
    });
  };

  const findByWorkspaceId = async (workspaceId: string) => {
    return db
      .select()
      .from(ScenarioTable)
      .where(eq(ScenarioTable.workspaceId, workspaceId));
  };

  const create = async (data: {
    workspaceId: string;
    name: string;
    description?: string;
    createdBy?: string;
  }) => {
    const [scenario] = await db
      .insert(ScenarioTable)
      .values({
        ...data,
        evaluation: emptyEvaluation(),
        actions: [],
      })
      .returning();
    return scenario;
  };

  const update = async (
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      evaluation: ScenarioEvaluation;
      actions: ScenarioActionConfig[];
    }>,
  ) => {
    const [scenario] = await db
      .update(ScenarioTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ScenarioTable.id, id))
      .returning();
    return scenario;
  };

  const deleteById = async (id: string) => {
    await db.delete(ScenarioTable).where(eq(ScenarioTable.id, id));
  };

  return {
    findById,
    findByWorkspaceId,
    create,
    update,
    deleteById,
  };
};

export type ScenarioRepository = ReturnType<typeof createScenarioRepository>;
