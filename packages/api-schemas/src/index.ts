import type { z } from "zod"

export {
	CreateWorkspaceRequestSchema,
	WorkspaceItemSchema,
	WorkspaceIdParamSchema,
	SetWorkspaceSecretsRequestSchema,
	ListWorkspacesResponseSchema,
	SyncWorkflowsResponseSchema,
	DefaultWorkspaceResponseSchema,
	SetDefaultWorkspaceRequestSchema,
	WorkspaceErrorSchema,
	workspaceSchemas,
} from "./workspaces.js"

export {
	TaskStatusSchema,
	CreateTaskRequestSchema,
	TaskMessageSchema,
	TaskItemSchema,
	TaskIdParamSchema,
	ListTasksQuerySchema,
	ListTasksResponseSchema,
	TaskDetailResponseSchema,
	UpdateLifecycleRequestSchema,
	UpdateLifecycleResponseSchema,
	ArchiveTaskResponseSchema,
	UnarchiveTaskResponseSchema,
	TaskErrorSchema,
	taskSchemas,
} from "./tasks.js"

export {
	McpConnectionItemSchema,
	AddMcpConnectionRequestSchema,
	AddMcpConnectionResponseSchema,
	ListMcpConnectionsResponseSchema,
	McpSessionTokenRequestSchema,
	McpSessionTokenResponseSchema,
	RemoveMcpConnectionResponseSchema,
	McpPreflightResponseSchema,
	McpErrorSchema,
	mcpSchemas,
} from "./mcp.js"

export {
	SkillItemSchema,
	AddSkillRequestSchema,
	AddSkillResponseSchema,
	ListSkillsResponseSchema,
	RemoveSkillResponseSchema,
	SkillErrorSchema,
	skillSchemas,
} from "./skills.js"

import { workspaceSchemas } from "./workspaces.js"
import { taskSchemas } from "./tasks.js"
import { mcpSchemas } from "./mcp.js"
import { skillSchemas } from "./skills.js"

export const allSchemas = [
	...workspaceSchemas,
	...taskSchemas,
	...mcpSchemas,
	...skillSchemas,
]

// --- Inferred TypeScript types ---

import type {
	CreateWorkspaceRequestSchema,
	WorkspaceItemSchema,
	ListWorkspacesResponseSchema,
	SetWorkspaceSecretsRequestSchema,
	SyncWorkflowsResponseSchema,
	DefaultWorkspaceResponseSchema,
	SetDefaultWorkspaceRequestSchema,
	WorkspaceErrorSchema,
} from "./workspaces.js"

import type {
	TaskStatusSchema,
	CreateTaskRequestSchema,
	TaskMessageSchema,
	TaskItemSchema,
	ListTasksQuerySchema,
	ListTasksResponseSchema,
	TaskDetailResponseSchema,
	UpdateLifecycleRequestSchema,
	UpdateLifecycleResponseSchema,
	ArchiveTaskResponseSchema,
	UnarchiveTaskResponseSchema,
	TaskErrorSchema,
} from "./tasks.js"

export type CreateWorkspaceRequest = z.infer<
	typeof CreateWorkspaceRequestSchema
>
export type WorkspaceItem = z.infer<typeof WorkspaceItemSchema>
export type ListWorkspacesResponse = z.infer<
	typeof ListWorkspacesResponseSchema
>
export type SetWorkspaceSecretsRequest = z.infer<
	typeof SetWorkspaceSecretsRequestSchema
>
export type SyncWorkflowsResponse = z.infer<typeof SyncWorkflowsResponseSchema>
export type DefaultWorkspaceResponse = z.infer<
	typeof DefaultWorkspaceResponseSchema
>
export type SetDefaultWorkspaceRequest = z.infer<
	typeof SetDefaultWorkspaceRequestSchema
>
export type WorkspaceError = z.infer<typeof WorkspaceErrorSchema>

export type TaskStatus = z.infer<typeof TaskStatusSchema>
export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>
export type TaskMessage = z.infer<typeof TaskMessageSchema>
export type TaskItem = z.infer<typeof TaskItemSchema>
export type ListTasksQuery = z.infer<typeof ListTasksQuerySchema>
export type ListTasksResponse = z.infer<typeof ListTasksResponseSchema>
export type TaskDetailResponse = z.infer<typeof TaskDetailResponseSchema>
export type UpdateLifecycleRequest = z.infer<
	typeof UpdateLifecycleRequestSchema
>
export type UpdateLifecycleResponse = z.infer<
	typeof UpdateLifecycleResponseSchema
>
export type ArchiveTaskResponse = z.infer<typeof ArchiveTaskResponseSchema>
export type UnarchiveTaskResponse = z.infer<typeof UnarchiveTaskResponseSchema>
export type TaskError = z.infer<typeof TaskErrorSchema>

import type {
	McpConnectionItemSchema,
	AddMcpConnectionRequestSchema,
	AddMcpConnectionResponseSchema,
	ListMcpConnectionsResponseSchema,
	McpSessionTokenRequestSchema,
	McpSessionTokenResponseSchema,
	RemoveMcpConnectionResponseSchema,
	McpPreflightResponseSchema,
	McpErrorSchema,
} from "./mcp.js"

export type McpConnectionItem = z.infer<typeof McpConnectionItemSchema>
export type AddMcpConnectionRequest = z.infer<
	typeof AddMcpConnectionRequestSchema
>
export type AddMcpConnectionResponse = z.infer<
	typeof AddMcpConnectionResponseSchema
>
export type ListMcpConnectionsResponse = z.infer<
	typeof ListMcpConnectionsResponseSchema
>
export type McpSessionTokenRequest = z.infer<
	typeof McpSessionTokenRequestSchema
>
export type McpSessionTokenResponse = z.infer<
	typeof McpSessionTokenResponseSchema
>
export type RemoveMcpConnectionResponse = z.infer<
	typeof RemoveMcpConnectionResponseSchema
>
export type McpPreflightResponse = z.infer<typeof McpPreflightResponseSchema>
export type McpError = z.infer<typeof McpErrorSchema>

import type {
	SkillItemSchema,
	AddSkillRequestSchema,
	AddSkillResponseSchema,
	ListSkillsResponseSchema,
	RemoveSkillResponseSchema,
	SkillErrorSchema,
} from "./skills.js"

export type SkillItem = z.infer<typeof SkillItemSchema>
export type AddSkillRequest = z.infer<typeof AddSkillRequestSchema>
export type AddSkillResponse = z.infer<typeof AddSkillResponseSchema>
export type ListSkillsResponse = z.infer<typeof ListSkillsResponseSchema>
export type RemoveSkillResponse = z.infer<typeof RemoveSkillResponseSchema>
export type SkillError = z.infer<typeof SkillErrorSchema>
