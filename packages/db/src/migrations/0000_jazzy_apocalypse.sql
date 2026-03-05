CREATE SCHEMA IF NOT EXISTS "flamecast";
--> statement-breakpoint
CREATE TYPE "flamecast"."workspace_status" AS ENUM('provisioning', 'ready', 'error');--> statement-breakpoint
CREATE TYPE "flamecast"."task_status" AS ENUM('submitted', 'working', 'input_required', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "flamecast"."github_oauth_tokens" (
	"user_id" text PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text DEFAULT '' NOT NULL,
	"expires_at" integer DEFAULT 0 NOT NULL,
	"scopes" text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flamecast"."user_organizations" (
	"user_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_organizations_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "flamecast"."workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"github_repo" text NOT NULL,
	"status" "flamecast"."workspace_status" DEFAULT 'provisioning' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_user_name" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "flamecast"."tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"status" "flamecast"."task_status" DEFAULT 'submitted' NOT NULL,
	"prompt" text NOT NULL,
	"target_repo" text,
	"base_branch" text DEFAULT 'main',
	"branch_name" text,
	"workflow_run_id" bigint,
	"pr_url" text,
	"error_message" text,
	"pending_input" jsonb,
	"callback_token" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flamecast"."task_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"workflow_run_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flamecast"."tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "flamecast"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flamecast"."task_messages" ADD CONSTRAINT "task_messages_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "flamecast"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspaces_user_id_idx" ON "flamecast"."workspaces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_workspace_created_idx" ON "flamecast"."tasks" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "task_messages_task_created_idx" ON "flamecast"."task_messages" USING btree ("task_id","created_at");