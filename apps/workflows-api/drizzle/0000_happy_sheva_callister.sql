CREATE TYPE "public"."document_type" AS ENUM('passport', 'national_id', 'drivers_license');--> statement-breakpoint
CREATE TYPE "public"."kyc_session_status" AS ENUM('started', 'form_completed', 'documents_uploaded', 'liveness_completed', 'submitted', 'under_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "kyc_document" (
	"id" text PRIMARY KEY NOT NULL,
	"kyc_session_id" text NOT NULL,
	"document_type" "document_type" NOT NULL,
	"minio_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_review" (
	"id" text PRIMARY KEY NOT NULL,
	"kyc_session_id" text NOT NULL,
	"reviewed_by" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_session" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"status" "kyc_session_status" DEFAULT 'started' NOT NULL,
	"first_name" text,
	"last_name" text,
	"date_of_birth" text,
	"nationality" text,
	"address" text,
	"city" text,
	"country" text,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liveness_check" (
	"id" text PRIMARY KEY NOT NULL,
	"kyc_session_id" text NOT NULL,
	"passed" boolean NOT NULL,
	"confidence" numeric(5, 4),
	"checks" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
