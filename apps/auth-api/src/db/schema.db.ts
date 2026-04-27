import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { generateId } from "@usercore/shared-types";

import { user } from "./auth.db";

export const WorkspaceTable = pgTable(
  "workspace",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId("workspace")),
    name: text("name").notNull(),
    // Slug is unique only within an organization — different orgs can have
    // workspaces with the same name without colliding.
    slug: text("slug").notNull(),
    organizationId: text("organization_id").notNull(),
    // Who created the workspace. Roles are at the org level — this is just an
    // audit field, not a permission marker.
    ownerId: text("owner_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueOrgSlug: uniqueIndex("workspace_org_slug_idx").on(
      table.organizationId,
      table.slug,
    ),
  }),
);

// Per-workspace member access. Org owners/admins implicitly have access to
// every workspace in their org; org members only see workspaces with an
// access row here.
export const WorkspaceAccessTable = pgTable(
  "workspace_access",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId("workspaceaccess")),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => WorkspaceTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Member who granted this access (member.id). Stored as text without an
    // FK so deleting the granting member doesn't cascade-delete the audit
    // trail. Nullable for legacy rows that pre-date this column.
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueWorkspaceUser: uniqueIndex("workspace_access_workspace_user_idx").on(
      table.workspaceId,
      table.userId,
    ),
  }),
);

export type Workspace = typeof WorkspaceTable.$inferSelect;
export type NewWorkspace = typeof WorkspaceTable.$inferInsert;
export type WorkspaceAccess = typeof WorkspaceAccessTable.$inferSelect;
