import { z } from "zod"

// --- Task status enum ---

export const TaskStatusSchema = z.enum([
	"submitted",
	"working",
	"input_required",
	"completed",
	"failed",
	"cancelled",
	"archived",
])

// --- Context item ---

export const ContextItemSchema = z
	.object({
		source: z.enum(["github_repo", "github_pr", "flamecast_run"]).meta({
			description: "Context source type",
		}),
		source_id: z.string().meta({ description: "Source identifier" }),
	})
	.meta({ id: "ContextItem" })

// --- POST /workspaces/:workspaceId/tasks ---

export const CreateTaskRequestSchema = z
	.object({
		prompt: z.string().min(1).meta({ description: "Task prompt" }),
		parent_run_id: z.string().optional().meta({
			description: "Parent workflow run ID (deprecated, use context)",
		}),
		context: z
			.array(ContextItemSchema)
			.optional()
			.meta({ description: "Context references for this task" }),
	})
	.passthrough()
	.meta({ id: "CreateTaskRequest" })

// --- Task message ---

export const TaskMessageSchema = z
	.object({
		id: z.string(),
		role: z.enum(["user", "agent"]),
		content: z.string(),
		workflowRunId: z.number().int().nullable().optional(),
		createdAt: z.string().meta({ description: "ISO 8601 timestamp" }),
	})
	.meta({ id: "TaskMessage" })

// --- Task item ---

export const TaskItemSchema = z
	.object({
		id: z.string().meta({ description: "GitHub Actions run ID (stringified)" }),
		workspaceId: z.string().uuid(),
		status: TaskStatusSchema,
		prompt: z.string(),
		workflowRunId: z.number().int().nullable(),
		errorMessage: z.string().nullable(),
		pendingInput: z
			.object({
				question: z.string(),
				options: z.array(z.string()).optional(),
			})
			.nullable(),
		startedAt: z
			.string()
			.nullable()
			.meta({ description: "ISO 8601 timestamp" }),
		completedAt: z
			.string()
			.nullable()
			.meta({ description: "ISO 8601 timestamp" }),
		createdAt: z.string().meta({ description: "ISO 8601 timestamp" }),
		lastUpdatedAt: z.string().meta({ description: "ISO 8601 timestamp" }),
	})
	.meta({ id: "TaskItem" })

// --- Params ---

export const TaskIdParamSchema = z.object({
	taskId: z
		.string()
		.meta({ description: "Task ID (GitHub Actions run ID as string)" }),
})

// --- GET /workspaces/:workspaceId/tasks ---

export const ListTasksQuerySchema = z
	.object({
		status: TaskStatusSchema.optional().meta({
			description: "Filter by task status",
		}),
		limit: z.coerce
			.number()
			.int()
			.min(1)
			.max(100)
			.optional()
			.meta({ description: "Max results per page (default 10, max 100)" }),
		cursor: z
			.string()
			.optional()
			.meta({ description: "Cursor for pagination (ISO 8601 timestamp)" }),
	})
	.meta({ id: "ListTasksQuery" })

export const ListTasksResponseSchema = z
	.object({
		tasks: z.array(TaskItemSchema),
		hasMore: z
			.boolean()
			.meta({ description: "Whether there are more results" }),
		nextCursor: z
			.string()
			.nullable()
			.meta({ description: "Cursor for next page" }),
	})
	.meta({ id: "ListTasksResponse" })

// --- GET /workspaces/:workspaceId/tasks/:taskId ---

export const TaskDetailResponseSchema = z
	.object({
		task: TaskItemSchema,
		messages: z.array(TaskMessageSchema),
		outputs: z.string().url().nullable().meta({
			description: "Optional URL to runs/{run_id} in the task repository",
		}),
		output: z.string().nullable().meta({
			description:
				"Task output content (markdown) from the database, if available",
		}),
		payload: z.record(z.string(), z.unknown()).nullable().meta({
			description: "Original task creation payload from the database",
		}),
		context: z.array(ContextItemSchema).meta({
			description: "Context references attached to this task",
		}),
	})
	.meta({ id: "TaskDetailResponse" })

// --- PUT /workspaces/:workspaceId/tasks/:taskId/lifecycle ---

export const UpdateLifecycleRequestSchema = z
	.object({
		lifecycle: z
			.enum(["started", "workflow_complete", "outputs_stored"])
			.meta({ description: "Target lifecycle state" }),
		output: z
			.string()
			.optional()
			.meta({ description: "Task output content to store" }),
	})
	.meta({ id: "UpdateLifecycleRequest" })

export const UpdateLifecycleResponseSchema = z
	.object({
		ok: z.boolean(),
		lifecycle: z.string().meta({ description: "Current lifecycle state" }),
	})
	.meta({ id: "UpdateLifecycleResponse" })

// --- POST /workspaces/:workspaceId/tasks/:taskId/archive ---

export const ArchiveTaskResponseSchema = z
	.object({
		ok: z.boolean(),
		status: z.literal("archived"),
	})
	.meta({ id: "ArchiveTaskResponse" })

// --- POST /workspaces/:workspaceId/tasks/:taskId/unarchive ---

export const UnarchiveTaskResponseSchema = z
	.object({
		ok: z.boolean(),
		status: z.literal("active"),
	})
	.meta({ id: "UnarchiveTaskResponse" })

// --- Error ---

export const TaskErrorSchema = z
	.object({
		error: z.string().meta({ example: "Not found" }),
	})
	.meta({ id: "TaskError" })

// Task schemas for OpenAPI injection
export const taskSchemas = [
	ContextItemSchema,
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
]
