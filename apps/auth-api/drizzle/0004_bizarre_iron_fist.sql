ALTER TABLE "organization" ADD COLUMN "plan" text DEFAULT 'STARTER' NOT NULL;--> statement-breakpoint
-- Flip every existing org to ENTERPRISE so dev work isn't blocked by Starter
-- quotas. New orgs created via /create-organization or the seed script keep
-- the column default (STARTER) unless overridden.
UPDATE "organization" SET "plan" = 'ENTERPRISE';
