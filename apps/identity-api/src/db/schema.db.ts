import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import {
  CUSTOMER_RISK_LEVELS,
  generateId,
  KYC_STATUSES,
} from "@usercore/shared-types";

export const kycStatusEnum = pgEnum("kyc_status", KYC_STATUSES);
export const customerRiskLevelEnum = pgEnum(
  "customer_risk_level",
  CUSTOMER_RISK_LEVELS,
);

export const CustomerProfileTable = pgTable("customer_profile", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("customerprofile")),
  customerId: text("customer_id").notNull().unique(),
  workspaceId: text("workspace_id").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  dateOfBirth: text("date_of_birth"),
  nationality: text("nationality"),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  kycStatus: kycStatusEnum("kyc_status").default("not_started").notNull(),
  // null = not yet assessed; set from AML risk on KYC completion / scenarios.
  riskLevel: customerRiskLevelEnum("risk_level"),
  kycSessionId: text("kyc_session_id"),
  kycCompletedAt: timestamp("kyc_completed_at"),
  // Soft archive — keeps the record (retention/audit) but moves it out of the
  // default customers view; "archived" is a filterable terminal state.
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CustomerProfile = typeof CustomerProfileTable.$inferSelect;
export type NewCustomerProfile = typeof CustomerProfileTable.$inferInsert;
