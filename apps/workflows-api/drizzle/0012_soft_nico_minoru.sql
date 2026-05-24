CREATE TABLE "workflow_session_event" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_session_id" text NOT NULL,
	"type" text NOT NULL,
	"detail" jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_session_event" ADD CONSTRAINT "workflow_session_event_workflow_session_id_workflow_session_id_fk" FOREIGN KEY ("workflow_session_id") REFERENCES "public"."workflow_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_session_event_session_idx" ON "workflow_session_event" USING btree ("workflow_session_id");