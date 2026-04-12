import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { generateId } from "@usercore/shared-types";

export const DashboardMemberSettingsTable = pgTable("dashboard_member_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("dms")),
  memberId: text("member_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  preferences: jsonb("preferences"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DashboardMemberSettings = typeof DashboardMemberSettingsTable.$inferSelect;
