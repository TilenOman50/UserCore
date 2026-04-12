import { boolean, numeric, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { generateId } from "@usercore/shared-types";

export const KYC_SESSION_STATUSES = [
  "started",
  "form_completed",
  "documents_uploaded",
  "liveness_completed",
  "submitted",
  "under_review",
  "approved",
  "rejected",
] as const;
export const kycSessionStatusEnum = pgEnum("kyc_session_status", KYC_SESSION_STATUSES);

export const DOCUMENT_TYPES = ["passport", "national_id", "drivers_license"] as const;
export const documentTypeEnum = pgEnum("document_type", DOCUMENT_TYPES);

export const KycSessionTable = pgTable("kyc_session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("kycsess")),
  userId: text("user_id").notNull(),
  workspaceId: text("workspace_id").notNull(),
  status: kycSessionStatusEnum("status").default("started").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  dateOfBirth: text("date_of_birth"),
  nationality: text("nationality"),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const KycDocumentTable = pgTable("kyc_document", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("kycdoc")),
  kycSessionId: text("kyc_session_id").notNull(),
  documentType: documentTypeEnum("document_type").notNull(),
  minioKey: text("minio_key").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const LivenessCheckTable = pgTable("liveness_check", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("liveness")),
  kycSessionId: text("kyc_session_id").notNull(),
  passed: boolean("passed").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  checks: text("checks").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const KycReviewTable = pgTable("kyc_review", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("kycrev")),
  kycSessionId: text("kyc_session_id").notNull(),
  reviewedBy: text("reviewed_by").notNull(),
  decision: text("decision", { enum: ["approved", "rejected"] }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type KycSession = typeof KycSessionTable.$inferSelect;
export type KycDocument = typeof KycDocumentTable.$inferSelect;
export type LivenessCheck = typeof LivenessCheckTable.$inferSelect;
export type KycReview = typeof KycReviewTable.$inferSelect;
