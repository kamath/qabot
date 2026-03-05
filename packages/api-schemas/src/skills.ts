import { z } from "zod"

// --- Skill item ---

export const SkillItemSchema = z
	.object({
		qualifiedName: z.string().meta({
			description: "Qualified name (e.g. anthropics/frontend-design)",
		}),
		slug: z.string().meta({ description: "Skill slug (directory name)" }),
		description: z
			.string()
			.optional()
			.meta({ description: "Skill description" }),
		gitUrl: z.string().url().optional().meta({ description: "Source Git URL" }),
	})
	.meta({ id: "SkillItem" })

// --- POST /workspaces/:workspaceId/skills ---

export const AddSkillRequestSchema = z
	.object({
		skill: z.string().min(1).meta({
			description:
				"Qualified skill name from Smithery registry (e.g. 'anthropics/frontend-design') or a git URL (e.g. 'https://github.com/owner/repo/tree/main/path')",
		}),
	})
	.meta({ id: "AddSkillRequest" })

export const AddSkillResponseSchema = z
	.object({
		skill: SkillItemSchema,
	})
	.meta({ id: "AddSkillResponse" })

// --- GET /workspaces/:workspaceId/skills ---

export const ListSkillsResponseSchema = z
	.object({
		skills: z.array(SkillItemSchema),
	})
	.meta({ id: "ListSkillsResponse" })

// --- DELETE /workspaces/:workspaceId/skills/:skill ---

export const RemoveSkillResponseSchema = z
	.object({
		success: z.boolean(),
	})
	.meta({ id: "RemoveSkillResponse" })

// --- Error ---

export const SkillErrorSchema = z
	.object({
		error: z.string().meta({ example: "Skill not found" }),
	})
	.meta({ id: "SkillError" })

// Skill schemas for OpenAPI injection
export const skillSchemas = [
	SkillItemSchema,
	AddSkillRequestSchema,
	AddSkillResponseSchema,
	ListSkillsResponseSchema,
	RemoveSkillResponseSchema,
	SkillErrorSchema,
]
