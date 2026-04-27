CREATE TYPE "public"."attribute_type" AS ENUM('STRING', 'BOOLEAN', 'NUMBER', 'DATE');--> statement-breakpoint
CREATE TYPE "public"."provider_short_name" AS ENUM('idenfy', 'complyAdvantage', 'ipQualityScore');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."workflow_step_type" AS ENUM('identity-verification', 'aml-screening', 'fraud-detection', 'duplicate-detection', 'rules-engine');--> statement-breakpoint
CREATE TYPE "public"."workflow_type" AS ENUM('USER_KYC');--> statement-breakpoint
CREATE TYPE "public"."workflow_verification_mode" AS ENUM('sandbox', 'production');--> statement-breakpoint
CREATE TABLE "aml_screening_step" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_step_id" text NOT NULL,
	"screen_on_created" boolean DEFAULT true NOT NULL,
	"monitor_ongoing" boolean DEFAULT false NOT NULL,
	"provider_config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "aml_screening_step_workflow_step_id_unique" UNIQUE("workflow_step_id")
);
--> statement-breakpoint
CREATE TABLE "duplicate_detection_step" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_step_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "duplicate_detection_step_workflow_step_id_unique" UNIQUE("workflow_step_id")
);
--> statement-breakpoint
CREATE TABLE "fraud_detection_step" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_step_id" text NOT NULL,
	"screen_on_created" boolean DEFAULT true NOT NULL,
	"provider_config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fraud_detection_step_workflow_step_id_unique" UNIQUE("workflow_step_id")
);
--> statement-breakpoint
CREATE TABLE "identity_verification_step" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_step_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "identity_verification_step_workflow_step_id_unique" UNIQUE("workflow_step_id")
);
--> statement-breakpoint
CREATE TABLE "identity_verification_sub_step" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"provider_config" jsonb,
	"valid" boolean DEFAULT false NOT NULL,
	"identity_verification_step_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "identity_verification_sub_step_unique_type" UNIQUE("identity_verification_step_id","type")
);
--> statement-breakpoint
CREATE TABLE "identity_widget" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"name" text,
	"logo_s3_object_key" text,
	"cover_s3_object_key" text,
	"show_cover_image" boolean DEFAULT false NOT NULL,
	"branding_main_color" text,
	"branding_cta_color" text,
	"branding_secondary_color" text,
	"bottom_content_title" text,
	"bottom_content_link" text,
	"bottom_content_description" text,
	"hosts" json DEFAULT '[]'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "identity_widget_workflow_id_unique" UNIQUE("workflow_id")
);
--> statement-breakpoint
CREATE TABLE "rules_engine_scenario" (
	"id" text PRIMARY KEY NOT NULL,
	"rules_engine_step_id" text NOT NULL,
	"external_scenario_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules_engine_step" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_step_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rules_engine_step_workflow_step_id_unique" UNIQUE("workflow_step_id")
);
--> statement-breakpoint
CREATE TABLE "workflow_session_attribute" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_session_id" text NOT NULL,
	"attribute" text NOT NULL,
	"value" text NOT NULL,
	"attribute_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_session_attribute_unique" UNIQUE("workflow_session_id","attribute")
);
--> statement-breakpoint
CREATE TABLE "workflow_session_step" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"step" text NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"trace_id" text,
	"parent_step_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_session_step_unique" UNIQUE("session_id","step")
);
--> statement-breakpoint
CREATE TABLE "workflow_session" (
	"id" text PRIMARY KEY NOT NULL,
	"external_session_id" text NOT NULL,
	"external_session_source" text NOT NULL,
	"workflow_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"verification_mode" "workflow_verification_mode" DEFAULT 'sandbox' NOT NULL,
	"active_device_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_session_unique" UNIQUE("external_session_id","external_session_source","workflow_id","customer_id","verification_mode")
);
--> statement-breakpoint
CREATE TABLE "workflow_step" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "workflow_step_type" NOT NULL,
	"workflow_id" text NOT NULL,
	"valid" boolean DEFAULT false NOT NULL,
	"provider" "provider_short_name",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_step_unique_workflow_type" UNIQUE("workflow_id","type")
);
--> statement-breakpoint
CREATE TABLE "workflow" (
	"id" text PRIMARY KEY NOT NULL,
	"status" "workflow_status" DEFAULT 'INACTIVE' NOT NULL,
	"type" "workflow_type" DEFAULT 'USER_KYC' NOT NULL,
	"workspace_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"display_name" text NOT NULL,
	"valid" boolean DEFAULT false NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verification_mode" "workflow_verification_mode" DEFAULT 'sandbox' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aml_screening_step" ADD CONSTRAINT "aml_screening_step_workflow_step_id_workflow_step_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."workflow_step"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_detection_step" ADD CONSTRAINT "duplicate_detection_step_workflow_step_id_workflow_step_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."workflow_step"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_detection_step" ADD CONSTRAINT "fraud_detection_step_workflow_step_id_workflow_step_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."workflow_step"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_verification_step" ADD CONSTRAINT "identity_verification_step_workflow_step_id_workflow_step_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."workflow_step"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_verification_sub_step" ADD CONSTRAINT "identity_verification_sub_step_identity_verification_step_id_identity_verification_step_id_fk" FOREIGN KEY ("identity_verification_step_id") REFERENCES "public"."identity_verification_step"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_widget" ADD CONSTRAINT "identity_widget_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules_engine_scenario" ADD CONSTRAINT "rules_engine_scenario_rules_engine_step_id_rules_engine_step_id_fk" FOREIGN KEY ("rules_engine_step_id") REFERENCES "public"."rules_engine_step"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules_engine_step" ADD CONSTRAINT "rules_engine_step_workflow_step_id_workflow_step_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."workflow_step"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_session_attribute" ADD CONSTRAINT "workflow_session_attribute_workflow_session_id_workflow_session_id_fk" FOREIGN KEY ("workflow_session_id") REFERENCES "public"."workflow_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_session_step" ADD CONSTRAINT "workflow_session_step_session_id_workflow_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workflow_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_session" ADD CONSTRAINT "workflow_session_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_step" ADD CONSTRAINT "workflow_step_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rules_engine_scenario_external_idx" ON "rules_engine_scenario" USING btree ("external_scenario_id");--> statement-breakpoint
CREATE INDEX "workflow_session_external_id_idx" ON "workflow_session" USING btree ("external_session_id");--> statement-breakpoint
CREATE INDEX "workflow_session_customer_idx" ON "workflow_session" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_unique_default_idx" ON "workflow" USING btree ("workspace_id","type","is_default") WHERE "workflow"."is_default" = TRUE;--> statement-breakpoint
CREATE INDEX "workflow_workspace_idx" ON "workflow" USING btree ("workspace_id","organization_id");--> statement-breakpoint
CREATE INDEX "workflow_status_idx" ON "workflow" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_type_idx" ON "workflow" USING btree ("type");