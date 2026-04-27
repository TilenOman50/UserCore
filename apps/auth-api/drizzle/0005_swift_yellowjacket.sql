ALTER TABLE "workspace" DROP CONSTRAINT "workspace_slug_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_org_slug_idx" ON "workspace" USING btree ("organization_id","slug");