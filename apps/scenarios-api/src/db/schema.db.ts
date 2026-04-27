import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type {
  ScenarioActionConfig,
  ScenarioEvaluation,
} from "@usercore/shared-types";
import { generateId } from "@usercore/shared-types";

export const ScenarioTable = pgTable("scenario", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("scenario")),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  // Tree of conditions and nested groups (jsonb). Validated by Zod on
  // read/write — see ScenarioEvaluationSchema in shared-types.
  evaluation: jsonb("evaluation").$type<ScenarioEvaluation>().notNull(),
  // Flat list of actions to execute when the evaluation tree resolves to true.
  actions: jsonb("actions").$type<ScenarioActionConfig[]>().notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Scenario = typeof ScenarioTable.$inferSelect;
