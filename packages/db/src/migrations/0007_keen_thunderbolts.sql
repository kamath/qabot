CREATE TYPE "flamecast"."task_status" AS ENUM('active', 'archived');--> statement-breakpoint
ALTER TABLE "flamecast"."tasks" ADD COLUMN "status" "flamecast"."task_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "flamecast"."tasks" USING btree ("status");