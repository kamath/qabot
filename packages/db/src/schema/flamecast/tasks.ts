import { index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import type { z } from "zod"
import { flamecastSchema } from "./github-oauth-tokens.js"
import { workspaces } from "./workspaces.js"

export const taskLifecycleEnum = flamecastSchema.enum("task_lifecycle", [
	"dispatched",
	"started",
	"workflow_complete",
	"outputs_stored",
])

export const taskStatusEnum = flamecastSchema.enum("task_status", [
	"active",
	"archived",
])

export const tasks = flamecastSchema.table(
	"tasks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		workflowRunId: text("workflow_run_id").unique(),
		lifecycle: taskLifecycleEnum("lifecycle").notNull().default("dispatched"),
		status: taskStatusEnum("status").notNull().default("active"),
		payload: jsonb("payload").notNull(),
		output: text("output"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	table => [
		index("tasks_workspace_id_idx").on(table.workspaceId),
		index("tasks_lifecycle_idx").on(table.lifecycle),
		index("tasks_status_idx").on(table.status),
	],
)

export const insertTaskSchema = createInsertSchema(tasks)
export const selectTaskSchema = createSelectSchema(tasks)

export type SelectTask = z.infer<typeof selectTaskSchema>
export type InsertTask = z.infer<typeof insertTaskSchema>
