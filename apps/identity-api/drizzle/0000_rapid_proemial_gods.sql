CREATE TYPE "public"."kyc_status" AS ENUM('not_started', 'pending', 'approved', 'rejected', 'flagged');--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"date_of_birth" text,
	"nationality" text,
	"address" text,
	"city" text,
	"country" text,
	"kyc_status" "kyc_status" DEFAULT 'not_started' NOT NULL,
	"kyc_session_id" text,
	"kyc_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_user_id_unique" UNIQUE("user_id")
);
