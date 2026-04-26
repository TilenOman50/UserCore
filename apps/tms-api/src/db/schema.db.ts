import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { generateId } from "@usercore/shared-types";

export const AuditLogTable = pgTable("audit_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("audit")),
  workspaceId: text("workspace_id").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AuditLog = typeof AuditLogTable.$inferSelect;
