CREATE TABLE "dashboard_member_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"preferences" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
