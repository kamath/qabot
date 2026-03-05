import {
	index,
	jsonb,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import type { z } from "zod"
import { flamecastSchema } from "./github-oauth-tokens.js"

export type WorkspaceConfig = {
	systemPrompt?: string
	tools?: string[]
}

export const workspaceStatusEnum = flamecastSchema.enum("workspace_status", [
	"provisioning",
	"ready",
	"error",
])

export const workspaces = flamecastSchema.table(
	"workspaces",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id").notNull(),
		name: text("name").notNull(),
		githubRepo: text("github_repo").notNull(),
		status: workspaceStatusEnum("status").notNull().default("provisioning"),
		config: jsonb("config").$type<WorkspaceConfig>().notNull().default({}),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	table => [
		unique("workspaces_user_name").on(table.userId, table.name),
		index("workspaces_user_id_idx").on(table.userId),
	],
)

export const insertWorkspaceSchema = createInsertSchema(workspaces)
export const selectWorkspaceSchema = createSelectSchema(workspaces)

export type SelectWorkspace = z.infer<typeof selectWorkspaceSchema>
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>
