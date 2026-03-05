import { z } from "zod"

// --- POST /workspaces ---

export const CreateWorkspaceRequestSchema = z
	.object({
		name: z
			.string()
			.min(1)
			.max(100)
			.regex(
				/^[a-z][a-z0-9-]*$/,
				"Name must be lowercase alphanumeric with hyphens",
			)
			.meta({ description: "Workspace name (used in repo name)" }),
		systemPrompt: z
			.string()
			.optional()
			.meta({ description: "System prompt for the agent" }),
		secrets: z
			.record(z.string(), z.string())
			.optional()
			.meta({ description: "Secrets to set on the GitHub repo" }),
		tools: z
			.array(z.string())
			.optional()
			.meta({ description: "MCP tool names to enable" }),
	})
	.meta({ id: "CreateWorkspaceRequest" })

// --- Workspace item ---

export const WorkspaceItemSchema = z
	.object({
		id: z.string().uuid(),
		name: z.string(),
		githubRepo: z.string().meta({ description: "owner/repo" }),
		status: z
			.enum(["provisioning", "ready", "error"])
			.meta({ description: "Workspace status" }),
		config: z
			.record(z.string(), z.unknown())
			.meta({ description: "Workspace config" }),
		secretNames: z
			.array(z.string())
			.optional()
			.meta({ description: "Names of secrets configured on the GitHub repo" }),
		createdAt: z.string().meta({ description: "ISO 8601 timestamp" }),
		updatedAt: z.string().meta({ description: "ISO 8601 timestamp" }),
	})
	.meta({ id: "WorkspaceItem" })

// --- Params ---

export const WorkspaceIdParamSchema = z.object({
	workspaceId: z
		.union([z.string().uuid(), z.literal("default")])
		.meta({ description: "Workspace UUID or 'default'" }),
})

// --- GET /workspaces ---

export const ListWorkspacesResponseSchema = z
	.object({
		workspaces: z.array(WorkspaceItemSchema),
	})
	.meta({ id: "ListWorkspacesResponse" })

// --- POST /workspaces/:workspaceId/secrets ---

export const SetWorkspaceSecretsRequestSchema = z
	.object({
		secrets: z.record(z.string(), z.string()).meta({
			description: "Key/value pairs to store as GitHub Actions secrets",
		}),
	})
	.meta({ id: "SetWorkspaceSecretsRequest" })

// --- POST /workspaces/:workspaceId/sync-workflows ---

export const SyncWorkflowsResponseSchema = z
	.object({
		success: z.boolean(),
		updated: z.array(z.string()).meta({
			description: "List of workflow file paths that were created or updated",
		}),
	})
	.meta({ id: "SyncWorkflowsResponse" })

// --- GET /workspaces/default ---

export const DefaultWorkspaceResponseSchema = z
	.object({
		defaultWorkspaceId: z.string().uuid().nullable(),
	})
	.meta({ id: "DefaultWorkspaceResponse" })

// --- PUT /workspaces/default ---

export const SetDefaultWorkspaceRequestSchema = z
	.object({
		workspaceId: z
			.string()
			.uuid()
			.meta({ description: "Workspace UUID to set as default" }),
	})
	.meta({ id: "SetDefaultWorkspaceRequest" })

// --- Error ---

export const WorkspaceErrorSchema = z
	.object({
		error: z.string().meta({ example: "Not found" }),
	})
	.meta({ id: "WorkspaceError" })

// Workspace schemas for OpenAPI injection
export const workspaceSchemas = [
	CreateWorkspaceRequestSchema,
	WorkspaceItemSchema,
	SetWorkspaceSecretsRequestSchema,
	ListWorkspacesResponseSchema,
	SyncWorkflowsResponseSchema,
	DefaultWorkspaceResponseSchema,
	SetDefaultWorkspaceRequestSchema,
	WorkspaceErrorSchema,
]
