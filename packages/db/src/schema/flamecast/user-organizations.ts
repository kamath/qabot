import { text, timestamp, uuid } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import type { z } from "zod"
import { flamecastSchema } from "./github-oauth-tokens.js"
import { workspaces } from "./workspaces.js"

export const userOrganizations = flamecastSchema.table("user_organizations", {
	userId: text("user_id").primaryKey(),
	organizationId: text("organization_id").notNull().unique(),
	defaultWorkspaceId: uuid("default_workspace_id").references(
		() => workspaces.id,
		{ onDelete: "set null" },
	),
	createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const insertUserOrganizationSchema =
	createInsertSchema(userOrganizations)
export const selectUserOrganizationSchema =
	createSelectSchema(userOrganizations)

export type SelectUserOrganization = z.infer<
	typeof selectUserOrganizationSchema
>
export type InsertUserOrganization = z.infer<
	typeof insertUserOrganizationSchema
>
