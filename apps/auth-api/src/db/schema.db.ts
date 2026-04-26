import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { generateId } from "@usercore/shared-types";

// Better Auth core tables are managed by Better Auth migrations.
// We define only our custom extensions here.

export const WORKSPACE_ROLES = ["owner", "admin", "member"] as const;
export const workspaceRole = pgEnum("workspace_role", WORKSPACE_ROLES);

export const WorkspaceTable = pgTable("workspace", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("workspace")),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  organizationId: text("organization_id").notNull(),
  ownerId: text("owner_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Workspace = typeof WorkspaceTable.$inferSelect;
export type NewWorkspace = typeof WorkspaceTable.$inferInsert;
