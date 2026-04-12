import { eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";

import type { Database } from "../../db/db";
import {
  ScenarioActionTable,
  ScenarioRuleTable,
  ScenarioTable,
} from "../../db/schema.db";

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

  const findActiveByWorkspaceId = async (workspaceId: string) => {
    return db
      .select()
      .from(ScenarioTable)
      .where(eq(ScenarioTable.workspaceId, workspaceId));
  };

  const create = async (data: {
    workspaceId: string;
    name: string;
    description?: string;
  }) => {
    const [scenario] = await db.insert(ScenarioTable).values(data).returning();
    return scenario;
  };

  const update = async (
    id: string,
    data: { name?: string; description?: string; isActive?: string },
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

  const findRulesByScenarioId = async (scenarioId: string) => {
    return db
      .select()
      .from(ScenarioRuleTable)
      .where(eq(ScenarioRuleTable.scenarioId, scenarioId));
  };

  const createRule = async (data: {
    scenarioId: string;
    field: string;
    operator: typeof ScenarioRuleTable.$inferInsert.operator;
    value: string;
  }) => {
    const [rule] = await db.insert(ScenarioRuleTable).values(data).returning();
    return rule;
  };

  const deleteRule = async (id: string) => {
    await db.delete(ScenarioRuleTable).where(eq(ScenarioRuleTable.id, id));
  };

  const findActionsByScenarioId = async (scenarioId: string) => {
    return db
      .select()
      .from(ScenarioActionTable)
      .where(eq(ScenarioActionTable.scenarioId, scenarioId));
  };

  const createAction = async (data: {
    scenarioId: string;
    actionType: typeof ScenarioActionTable.$inferInsert.actionType;
    config?: Record<string, unknown>;
  }) => {
    const [action] = await db.insert(ScenarioActionTable).values(data).returning();
    return action;
  };

  return {
    findById,
    findByWorkspaceId,
    findActiveByWorkspaceId,
    create,
    update,
    deleteById,
    findRulesByScenarioId,
    createRule,
    deleteRule,
    findActionsByScenarioId,
    createAction,
  };
};

export type ScenarioRepository = ReturnType<typeof createScenarioRepository>;
