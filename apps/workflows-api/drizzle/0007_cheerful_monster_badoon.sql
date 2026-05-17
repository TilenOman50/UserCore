CREATE TABLE "provider_configuration" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" "provider_short_name" NOT NULL,
	"api_key" text,
	"api_secret" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"last_tested_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_configuration_unique_org_provider" UNIQUE("organization_id","provider")
);
--> statement-breakpoint
CREATE INDEX "provider_configuration_organization_idx" ON "provider_configuration" USING btree ("organization_id");