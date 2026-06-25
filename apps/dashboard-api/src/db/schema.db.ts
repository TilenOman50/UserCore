import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { generateId } from "@usercore/shared-types";

export const DashboardMemberSettingsTable = pgTable(
  "dashboard_member_settings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId("dashboardmember")),
    // Unique because the dashboard upserts settings keyed by member id —
    // every member has ONE settings row regardless of which workspace they
    // last touched it from. Postgres needs the constraint to back the
    // `onConflictDoUpdate({ target: memberId })` upsert.
    memberId: text("member_id").notNull().unique(),
    workspaceId: text("workspace_id").notNull(),
    preferences: jsonb("preferences"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

export type DashboardMemberSettings =
  typeof DashboardMemberSettingsTable.$inferSelect;
