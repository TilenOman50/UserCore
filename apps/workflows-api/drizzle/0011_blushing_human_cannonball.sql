ALTER TABLE "workflow_session" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "workflow_session" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "workflow_session" ADD COLUMN "delete_reason" text;