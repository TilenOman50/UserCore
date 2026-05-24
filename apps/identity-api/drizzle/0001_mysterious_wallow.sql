CREATE TYPE "public"."customer_risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
ALTER TABLE "customer_profile" ADD COLUMN "risk_level" "customer_risk_level";--> statement-breakpoint
ALTER TABLE "customer_profile" ADD COLUMN "archived_at" timestamp;