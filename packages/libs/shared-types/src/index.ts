import { nanoid } from "nanoid";
import { z } from "zod";

// ID generation — mirrors the platform's generateId pattern
export const generateId = (prefix: string): string => {
  return `${prefix}_${nanoid()}`;
};

// KYC status enum
export const KYC_STATUSES = [
  "not_started",
  "pending",
  "approved",
  "rejected",
  "flagged",
] as const;
export const KycStatusEnum = z.enum(KYC_STATUSES);
export type KycStatus = z.infer<typeof KycStatusEnum>;

// Pagination schema
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;

// RabbitMQ event payload types
export const EVENTS = {
  WORKSPACE_CREATED: "workspace.created",
  WORKSPACE_DELETED: "workspace.deleted",
  KYC_COMPLETED: "kyc.completed",
  KYC_NOTIFICATION: "kyc.notification",
  SCENARIO_TRIGGERED: "scenario.triggered",
} as const;

export const WorkspaceCreatedPayload = z.object({
  workspaceId: z.string(),
  name: z.string(),
  ownerId: z.string(),
});
export type WorkspaceCreatedPayload = z.infer<typeof WorkspaceCreatedPayload>;

export const WorkspaceDeletedPayload = z.object({
  workspaceId: z.string(),
  organizationId: z.string(),
});
export type WorkspaceDeletedPayload = z.infer<typeof WorkspaceDeletedPayload>;

export const KycCompletedPayload = z.object({
  kycSessionId: z.string(),
  customerId: z.string(),
  workspaceId: z.string(),
  status: KycStatusEnum,
  reviewedAt: z.string().datetime(),
  reviewedBy: z.string(),
  reason: z.string().optional(),
});
export type KycCompletedPayload = z.infer<typeof KycCompletedPayload>;

export const KycNotificationPayload = z.object({
  customerId: z.string(),
  email: z.string().email(),
  status: KycStatusEnum,
  reason: z.string().optional(),
});
export type KycNotificationPayload = z.infer<typeof KycNotificationPayload>;

export const ScenarioTriggeredPayload = z.object({
  scenarioId: z.string(),
  customerId: z.string(),
  workspaceId: z.string(),
  actionType: z.enum(["email_notification", "flag_user", "auto_reject"]),
});
export type ScenarioTriggeredPayload = z.infer<typeof ScenarioTriggeredPayload>;

// Common API response helpers
export const createSuccessResponse = <T>(data: T) => ({ data });
export const createErrorResponse = (error: string) => ({ error });
