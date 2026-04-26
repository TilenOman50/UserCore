import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { generateId, KYC_STATUSES } from "@usercore/shared-types";

export const kycStatusEnum = pgEnum("kyc_status", KYC_STATUSES);

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
  kycSessionId: text("kyc_session_id"),
  kycCompletedAt: timestamp("kyc_completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CustomerProfile = typeof CustomerProfileTable.$inferSelect;
export type NewCustomerProfile = typeof CustomerProfileTable.$inferInsert;
