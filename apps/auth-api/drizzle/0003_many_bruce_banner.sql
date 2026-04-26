ALTER TABLE "workspace_access" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "workspace_access" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;