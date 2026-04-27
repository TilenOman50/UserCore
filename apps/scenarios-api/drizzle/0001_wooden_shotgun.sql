ALTER TABLE "scenario_action" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scenario_execution" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scenario_rule" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "scenario_action" CASCADE;--> statement-breakpoint
DROP TABLE "scenario_execution" CASCADE;--> statement-breakpoint
DROP TABLE "scenario_rule" CASCADE;--> statement-breakpoint
ALTER TABLE "scenario" ALTER COLUMN "is_active" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scenario" ALTER COLUMN "is_active" SET DATA TYPE boolean USING ("is_active"::boolean);--> statement-breakpoint
ALTER TABLE "scenario" ALTER COLUMN "is_active" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "scenario" ADD COLUMN "evaluation" jsonb NOT NULL DEFAULT '{"operator":"AND","queries":[],"queryGroups":[]}'::jsonb;--> statement-breakpoint
ALTER TABLE "scenario" ADD COLUMN "actions" jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
DROP TYPE "public"."action_type";--> statement-breakpoint
DROP TYPE "public"."rule_operator";
