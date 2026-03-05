CREATE TYPE "flamecast"."task_lifecycle" AS ENUM('dispatched', 'started', 'workflow_complete', 'outputs_stored');--> statement-breakpoint
CREATE TABLE "flamecast"."tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"workflow_run_id" text,
	"lifecycle" "flamecast"."task_lifecycle" DEFAULT 'dispatched' NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_workflow_run_id_unique" UNIQUE("workflow_run_id")
);
--> statement-breakpoint
ALTER TABLE "flamecast"."tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "flamecast"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_workspace_id_idx" ON "flamecast"."tasks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "tasks_lifecycle_idx" ON "flamecast"."tasks" USING btree ("lifecycle");