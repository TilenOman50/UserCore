import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { generateId } from "@usercore/shared-types";

export const RULE_OPERATORS = [
  "eq",
  "neq",
  "gt",
  "lt",
  "gte",
  "lte",
  "in",
  "contains",
] as const;
export const ruleOperatorEnum = pgEnum("rule_operator", RULE_OPERATORS);

export const ACTION_TYPES = [
  "email_notification",
  "flag_user",
  "auto_reject",
] as const;
export const actionTypeEnum = pgEnum("action_type", ACTION_TYPES);

export const ScenarioTable = pgTable("scenario", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("scenario")),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: text("is_active").default("true").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ScenarioRuleTable = pgTable("scenario_rule", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("scenariorule")),
  scenarioId: text("scenario_id").notNull(),
  field: text("field").notNull(), // e.g. "country", "dateOfBirth", "nationality"
  operator: ruleOperatorEnum("operator").notNull(),
  value: text("value").notNull(), // stored as string, coerced at evaluation time
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ScenarioActionTable = pgTable("scenario_action", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("action")),
  scenarioId: text("scenario_id").notNull(),
  actionType: actionTypeEnum("action_type").notNull(),
  config: jsonb("config"), // e.g. { "emailTemplate": "flag_alert", "message": "..." }
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ScenarioExecutionTable = pgTable("scenario_execution", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("scenarioexec")),
  scenarioId: text("scenario_id").notNull(),
  userId: text("user_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  triggered: text("triggered").default("false").notNull(),
  actionsExecuted: text("actions_executed").array(),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});

export type Scenario = typeof ScenarioTable.$inferSelect;
export type ScenarioRule = typeof ScenarioRuleTable.$inferSelect;
export type ScenarioAction = typeof ScenarioActionTable.$inferSelect;
export type ScenarioExecution = typeof ScenarioExecutionTable.$inferSelect;
