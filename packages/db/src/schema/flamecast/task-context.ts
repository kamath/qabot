import { index, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import type { z } from "zod"
import { flamecastSchema } from "./github-oauth-tokens.js"
import { tasks } from "./tasks.js"
import { workspaces } from "./workspaces.js"

export const contextSourceEnum = flamecastSchema.enum("context_source", [
	"github_repo",
	"github_pr",
	"flamecast_run",
])

export const taskContext = flamecastSchema.table(
	"task_context",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		taskId: uuid("task_id")
			.notNull()
			.references(() => tasks.id, { onDelete: "cascade" }),
		source: contextSourceEnum("source").notNull(),
		sourceId: text("source_id").notNull(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	table => [
		index("task_context_task_id_idx").on(table.taskId),
		index("task_context_workspace_id_idx").on(table.workspaceId),
	],
)

export const insertTaskContextSchema = createInsertSchema(taskContext)
export const selectTaskContextSchema = createSelectSchema(taskContext)

export type SelectTaskContext = z.infer<typeof selectTaskContextSchema>
export type InsertTaskContext = z.infer<typeof insertTaskContextSchema>
