DROP INDEX "workflow_status_idx";--> statement-breakpoint
ALTER TABLE "workflow" DROP COLUMN "status";--> statement-breakpoint
DROP TYPE "public"."workflow_status";