CREATE TYPE "flamecast"."context_source" AS ENUM('github_repo', 'github_pr', 'flamecast_run');--> statement-breakpoint
CREATE TABLE "flamecast"."task_context" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"source" "flamecast"."context_source" NOT NULL,
	"source_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flamecast"."task_context" ADD CONSTRAINT "task_context_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "flamecast"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flamecast"."task_context" ADD CONSTRAINT "task_context_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "flamecast"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_context_task_id_idx" ON "flamecast"."task_context" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_context_workspace_id_idx" ON "flamecast"."task_context" USING btree ("workspace_id");