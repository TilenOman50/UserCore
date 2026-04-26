CREATE TYPE "public"."action_type" AS ENUM('email_notification', 'flag_user', 'auto_reject');--> statement-breakpoint
CREATE TYPE "public"."rule_operator" AS ENUM('eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'contains');--> statement-breakpoint
CREATE TABLE "scenario_action" (
	"id" text PRIMARY KEY NOT NULL,
	"scenario_id" text NOT NULL,
	"action_type" "action_type" NOT NULL,
	"config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_execution" (
	"id" text PRIMARY KEY NOT NULL,
	"scenario_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"triggered" text DEFAULT 'false' NOT NULL,
	"actions_executed" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"scenario_id" text NOT NULL,
	"field" text NOT NULL,
	"operator" "rule_operator" NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" text DEFAULT 'true' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
