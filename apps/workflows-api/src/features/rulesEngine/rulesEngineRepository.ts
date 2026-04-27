import { and, eq } from "drizzle-orm";

import type { Logger } from "@usercore/logger";

import type { Database } from "../../db/db";
import {
  RulesEngineScenarioTable,
  RulesEngineStepTable,
  WorkflowStepTable,
  WorkflowTable,
} from "../../db/schema.db";

export const createRulesEngineRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const createStep = async (workflowStepId: string) => {
    const [step] = await db
      .insert(RulesEngineStepTable)
      .values({ workflowStepId })
      .returning();
    return step;
  };

  const findStepByWorkflowStepId = async (workflowStepId: string) => {
    return db.query.RulesEngineStepTable.findFirst({
      where: eq(RulesEngineStepTable.workflowStepId, workflowStepId),
    });
  };

  const findStepById = async (id: string) => {
    return db.query.RulesEngineStepTable.findFirst({
      where: eq(RulesEngineStepTable.id, id),
    });
  };

  const listScenarios = async (rulesEngineStepId: string) => {
    return db
      .select()
      .from(RulesEngineScenarioTable)
      .where(eq(RulesEngineScenarioTable.rulesEngineStepId, rulesEngineStepId));
  };

  const linkScenario = async (data: {
    rulesEngineStepId: string;
    externalScenarioId: string;
  }) => {
    const existing = await db.query.RulesEngineScenarioTable.findFirst({
      where: and(
        eq(RulesEngineScenarioTable.rulesEngineStepId, data.rulesEngineStepId),
        eq(
          RulesEngineScenarioTable.externalScenarioId,
          data.externalScenarioId,
        ),
      ),
    });
    if (existing) return existing;
    const [scenario] = await db
      .insert(RulesEngineScenarioTable)
      .values(data)
      .returning();
    return scenario;
  };

  const unlinkScenario = async (id: string) => {
    await db
      .delete(RulesEngineScenarioTable)
      .where(eq(RulesEngineScenarioTable.id, id));
  };

  // Returns Map<externalScenarioId, workflowStepIds[]> for every scenario
  // linked from any rules-engine step in any workflow in the workspace.
  // Powers the "linked to N workflows" indicator in the dashboard.
  const findScenarioLinksByWorkspace = async (workspaceId: string) => {
    const rows = await db
      .select({
        externalScenarioId: RulesEngineScenarioTable.externalScenarioId,
        workflowStepId: WorkflowStepTable.id,
        workflowId: WorkflowTable.id,
        workflowName: WorkflowTable.displayName,
      })
      .from(RulesEngineScenarioTable)
      .innerJoin(
        RulesEngineStepTable,
        eq(RulesEngineScenarioTable.rulesEngineStepId, RulesEngineStepTable.id),
      )
      .innerJoin(
        WorkflowStepTable,
        eq(RulesEngineStepTable.workflowStepId, WorkflowStepTable.id),
      )
      .innerJoin(
        WorkflowTable,
        and(
          eq(WorkflowStepTable.workflowId, WorkflowTable.id),
          eq(WorkflowTable.workspaceId, workspaceId),
        ),
      );

    const map = new Map<
      string,
      Array<{
        workflowId: string;
        workflowStepId: string;
        workflowName: string;
      }>
    >();
    for (const row of rows) {
      const list = map.get(row.externalScenarioId) ?? [];
      list.push({
        workflowId: row.workflowId,
        workflowStepId: row.workflowStepId,
        workflowName: row.workflowName,
      });
      map.set(row.externalScenarioId, list);
    }
    return map;
  };

  return {
    createStep,
    findStepByWorkflowStepId,
    findStepById,
    listScenarios,
    linkScenario,
    unlinkScenario,
    findScenarioLinksByWorkspace,
  };
};

export type RulesEngineRepository = ReturnType<
  typeof createRulesEngineRepository
>;
