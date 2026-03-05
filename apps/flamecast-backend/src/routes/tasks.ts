import { Hono, type Context } from "hono"
import { validator as zValidator, describeRoute, resolver } from "hono-openapi"
import {
	CreateTaskRequestSchema,
	ListTasksQuerySchema,
	TaskItemSchema,
	ListTasksResponseSchema,
	TaskDetailResponseSchema,
	TaskErrorSchema,
	UpdateLifecycleRequestSchema,
	UpdateLifecycleResponseSchema,
	ArchiveTaskResponseSchema,
	UnarchiveTaskResponseSchema,
} from "@flamecast/api-schemas"
import { and, eq, inArray } from "drizzle-orm"
import { getGitHubAccessToken } from "../lib/auth"
import { getOctokit, type OctokitClient } from "../lib/octokit"
import { RequestError } from "@octokit/request-error"
import { dispatchWorkflow } from "../lib/dispatch"
import { workspaceMiddleware, type WorkspaceEnv } from "../lib/middleware"
import {
	createSmitheryClient,
	listConnections,
	preflightConnections,
} from "../lib/smithery"
import {
	tasks as tasksTable,
	taskContext as taskContextTable,
} from "@flamecast/db/schema"
import { trackEvent, AnalyticsEvents } from "../lib/analytics"

const LIFECYCLE_ORDER = [
	"dispatched",
	"started",
	"workflow_complete",
	"outputs_stored",
] as const

type Lifecycle = (typeof LIFECYCLE_ORDER)[number]

const lifecycleRank: Record<Lifecycle, number> = Object.fromEntries(
	LIFECYCLE_ORDER.map((v, i) => [v, i]),
) as Record<Lifecycle, number>

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"])

type TaskStatus =
	| "submitted"
	| "working"
	| "input_required"
	| "completed"
	| "failed"
	| "cancelled"
	| "archived"

type TaskRecordStatus = "active" | "archived"

type GitHubWorkflowRun = {
	id: number
	name: string | null
	display_title: string | null
	status: string | null
	conclusion: string | null
	created_at: string
	updated_at: string
	run_started_at: string | null
	path?: string | null
}

function mapRunStatus(run: GitHubWorkflowRun): TaskStatus {
	if (run.status === "completed") {
		if (run.conclusion === "success") return "completed"
		if (run.conclusion === "cancelled" || run.conclusion === "skipped") {
			return "cancelled"
		}
		return "failed"
	}

	if (run.status === "in_progress") return "working"

	if (
		run.status === "queued" ||
		run.status === "requested" ||
		run.status === "waiting" ||
		run.status === "pending"
	) {
		return "submitted"
	}

	return "working"
}

function derivePrompt(run: GitHubWorkflowRun) {
	const title = run.display_title?.trim()
	if (title && title.toLowerCase() !== "flamecast") {
		return title
	}

	if (run.name?.trim()) {
		return `${run.name} run #${run.id}`
	}

	return `Flamecast run #${run.id}`
}

function isFlamecastRun(run: GitHubWorkflowRun) {
	if (run.path?.includes(".github/workflows/flamecast.yml")) return true
	return (run.name ?? "").toLowerCase() === "flamecast"
}

function serializeTask(run: GitHubWorkflowRun, workspaceId: string) {
	const status = mapRunStatus(run)
	const isTerminal = TERMINAL_STATUSES.has(status)
	const errorMessage =
		status === "failed"
			? run.conclusion
				? `Workflow concluded with '${run.conclusion}'`
				: "Workflow failed"
			: null

	return {
		id: String(run.id),
		workspaceId,
		status,
		prompt: derivePrompt(run),
		workflowRunId: run.id,
		errorMessage,
		pendingInput: null,
		startedAt: run.run_started_at,
		completedAt: isTerminal ? run.updated_at : null,
		createdAt: run.created_at,
		lastUpdatedAt: run.updated_at,
	}
}

function applyTaskRecordStatus(
	task: ReturnType<typeof serializeTask>,
	recordStatus: TaskRecordStatus | null | undefined,
) {
	if (recordStatus === "archived" && TERMINAL_STATUSES.has(task.status)) {
		return {
			...task,
			status: "archived" as const,
		}
	}

	return task
}

function serializeFallbackTask(opts: {
	workspaceId: string
	prompt: string
	runId: number
}) {
	const now = new Date().toISOString()
	return {
		id: String(opts.runId),
		workspaceId: opts.workspaceId,
		status: "submitted" as const,
		prompt: opts.prompt,
		workflowRunId: opts.runId,
		errorMessage: null,
		pendingInput: null,
		startedAt: null,
		completedAt: null,
		createdAt: now,
		lastUpdatedAt: now,
	}
}

function serializeMessages(run: GitHubWorkflowRun) {
	return [
		{
			id: `run-${run.id}-prompt`,
			role: "user" as const,
			content: derivePrompt(run),
			workflowRunId: run.id,
			createdAt: run.created_at,
		},
	]
}

function parseRunId(taskId: string) {
	const parsed = Number.parseInt(taskId, 10)
	if (!Number.isSafeInteger(parsed) || parsed <= 0) return null
	return parsed
}

async function getGitHubContext(c: Context<WorkspaceEnv>) {
	const db = c.get("db")
	const authRow = c.get("authRow")
	const ws = c.get("workspace")

	const accessToken = await getGitHubAccessToken(db, authRow.userId)
	if (!accessToken) return null

	const [owner, repo] = ws.githubRepo.split("/")
	if (!owner || !repo) return null

	return {
		workspaceId: ws.id,
		owner,
		repo,
		accessToken,
		octokit: getOctokit(accessToken),
	}
}

async function fetchWorkflowRun(
	ctx: {
		owner: string
		repo: string
		octokit: OctokitClient
	},
	runId: number,
) {
	try {
		const { data: run } = await ctx.octokit.actions.getWorkflowRun({
			owner: ctx.owner,
			repo: ctx.repo,
			run_id: runId,
		})

		const typedRun = run as unknown as GitHubWorkflowRun
		if (!isFlamecastRun(typedRun)) return null
		return typedRun
	} catch (err) {
		if (err instanceof RequestError && err.status === 404) return null
		throw err
	}
}

async function fetchRunOutputsUrl(
	ctx: {
		owner: string
		repo: string
		octokit: OctokitClient
	},
	runId: number,
) {
	try {
		await ctx.octokit.repos.getContent({
			owner: ctx.owner,
			repo: ctx.repo,
			path: `runs/${runId}`,
		})

		return `https://github.com/${ctx.owner}/${ctx.repo}/tree/HEAD/runs/${runId}`
	} catch (err) {
		if (err instanceof RequestError && err.status === 404) return null
		throw err
	}
}

type ContextSource = "github_repo" | "github_pr" | "flamecast_run"
type ContextItem = { source: ContextSource; source_id: string }

const VALID_SOURCES = new Set<string>([
	"github_repo",
	"github_pr",
	"flamecast_run",
])

function isContextSource(value: string): value is ContextSource {
	return VALID_SOURCES.has(value)
}

/** Normalize legacy fields + explicit context into a deduplicated context array. */
function normalizeContext(body: Record<string, unknown>): ContextItem[] {
	const items: ContextItem[] = []

	// Explicit context array
	if (Array.isArray(body.context)) {
		for (const entry of body.context) {
			if (
				entry &&
				typeof entry === "object" &&
				"source" in entry &&
				"source_id" in entry &&
				typeof entry.source === "string" &&
				typeof entry.source_id === "string" &&
				isContextSource(entry.source)
			) {
				items.push({ source: entry.source, source_id: entry.source_id })
			}
		}
	}

	// Legacy parent_run_id
	if (typeof body.parent_run_id === "string" && body.parent_run_id) {
		items.push({ source: "flamecast_run", source_id: body.parent_run_id })
	}

	// Legacy url_references
	if (Array.isArray(body.url_references)) {
		for (const ref of body.url_references) {
			if (typeof ref !== "string") continue
			const isPr = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/pull\/[0-9]+/i.test(
				ref,
			)
			items.push({
				source: isPr ? "github_pr" : "github_repo",
				source_id: ref,
			})
		}
	}

	// Deduplicate by source+source_id
	const seen = new Set<string>()
	return items.filter(item => {
		const key = `${item.source}:${item.source_id}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

const tasks = new Hono<WorkspaceEnv>()
	.use(workspaceMiddleware)
	.post(
		"/",
		describeRoute({
			description:
				"Create a new task and dispatch a GitHub Actions workflow to execute it.",
			tags: ["tasks"],
			responses: {
				200: {
					description: "Task created and workflow dispatched",
					content: {
						"application/json": { schema: resolver(TaskItemSchema) },
					},
				},
				201: {
					description: "Task created (workflow not yet dispatched)",
					content: {
						"application/json": { schema: resolver(TaskItemSchema) },
					},
				},
			},
		}),
		zValidator("json", CreateTaskRequestSchema),
		async c => {
			const ws = c.get("workspace")
			const authRow = c.get("authRow")
			const gh = await getGitHubContext(c)
			if (!gh) return c.json({ error: "GitHub token not found" }, 403)

			const body = c.req.valid("json")
			const trimmedPrompt = body.prompt.trim()

			// Preflight MCP connections if any exist
			const smitheryClient = createSmitheryClient(c.env.SMITHERY_API_KEY)
			let conns: Awaited<ReturnType<typeof listConnections>> = []

			try {
				conns = await listConnections(smitheryClient, ws.id)
			} catch (err) {
				console.error("MCP listConnections failed:", err)
				// Non-fatal — proceed with dispatch without connections
			}

			if (conns.length > 0) {
				const preflight = preflightConnections(conns)
				if (preflight.authRequired.length > 0) {
					return c.json(
						{
							ready: preflight.ready,
							authRequired: preflight.authRequired,
							errors: preflight.errors,
						},
						428,
					)
				}
			}

			const payload = {
				...body,
				prompt: trimmedPrompt,
				workspace_id: ws.id,
				flamecast_api_url:
					c.req.url.replace(/\/workspaces\/.*/, "") ||
					"https://api.flamecast.dev",
			}

			const inputs: Record<string, string> = {
				payload: JSON.stringify(payload),
			}

			trackEvent(c.env, authRow.userId, AnalyticsEvents.TASK_CREATED, {
				workspaceId: ws.id,
				promptLength: trimmedPrompt.length,
			})

			const dispatchResult = await dispatchWorkflow({
				accessToken: gh.accessToken,
				owner: gh.owner,
				repo: gh.repo,
				inputs,
			})

			if (!dispatchResult.dispatched) {
				return c.json(
					{
						error:
							dispatchResult.dispatchError || "Failed to dispatch workflow run",
					},
					502,
				)
			}

			const workflowRunId = dispatchResult.workflowRunId

			// Normalize context from body (explicit context + legacy fields)
			const contextItems = normalizeContext(body)

			// Track task in DB
			const db = c.get("db")
			try {
				const [taskRow] = await db
					.insert(tasksTable)
					.values({
						workspaceId: ws.id,
						workflowRunId: workflowRunId ? String(workflowRunId) : null,
						lifecycle: "dispatched",
						status: "active",
						payload: body,
					})
					.returning({ id: tasksTable.id })

				if (taskRow && contextItems.length > 0) {
					await db.insert(taskContextTable).values(
						contextItems.map(item => ({
							workspaceId: ws.id,
							taskId: taskRow.id,
							source: item.source,
							sourceId: item.source_id,
						})),
					)
				}
			} catch (err) {
				console.error("Failed to insert task row:", err)
				// Non-fatal — continue with response even if DB insert fails
			}

			if (!workflowRunId) {
				// Dispatch succeeded but GH run lookup is eventually consistent.
				return c.json(
					{
						id: crypto.randomUUID(),
						workspaceId: ws.id,
						status: "submitted",
						prompt: trimmedPrompt,
						workflowRunId: null,
						errorMessage: null,
						pendingInput: null,
						startedAt: null,
						completedAt: null,
						createdAt: new Date().toISOString(),
						lastUpdatedAt: new Date().toISOString(),
					},
					201,
				)
			}

			try {
				const run = await fetchWorkflowRun(gh, workflowRunId)
				if (run) return c.json(serializeTask(run, ws.id))
			} catch {
				// Fall through to fallback response.
			}

			return c.json(
				serializeFallbackTask({
					workspaceId: ws.id,
					prompt: trimmedPrompt,
					runId: workflowRunId,
				}),
			)
		},
	)
	.get(
		"/",
		describeRoute({
			description:
				"List tasks for a workspace with optional status filter and cursor-based pagination.",
			tags: ["tasks"],
			responses: {
				200: {
					description: "Paginated list of tasks",
					content: {
						"application/json": {
							schema: resolver(ListTasksResponseSchema),
						},
					},
				},
			},
		}),
		zValidator("query", ListTasksQuerySchema),
		async c => {
			const gh = await getGitHubContext(c)
			if (!gh) return c.json({ error: "GitHub token not found" }, 403)
			const db = c.get("db")

			const { status, limit: rawLimit, cursor } = c.req.valid("query")
			const limit = rawLimit ?? 10
			const cursorMs = cursor ? Date.parse(cursor) : null
			const collected: ReturnType<typeof serializeTask>[] = []
			const perPage = 100

			for (let page = 1; page <= 10 && collected.length < limit + 1; page++) {
				try {
					const { data: runsData } = await gh.octokit.actions.listWorkflowRuns({
						owner: gh.owner,
						repo: gh.repo,
						workflow_id: "flamecast.yml",
						event: "workflow_dispatch",
						per_page: perPage,
						page,
					})

					const runs =
						(runsData.workflow_runs as unknown as GitHubWorkflowRun[]) ?? []
					if (runs.length === 0) break

					const runIds = runs.map(run => String(run.id))
					const taskStatusesByRunId = new Map<string, TaskRecordStatus>()
					if (runIds.length > 0) {
						const taskRows = await db
							.select({
								workflowRunId: tasksTable.workflowRunId,
								status: tasksTable.status,
							})
							.from(tasksTable)
							.where(
								and(
									eq(tasksTable.workspaceId, gh.workspaceId),
									inArray(tasksTable.workflowRunId, runIds),
								),
							)

						for (const row of taskRows) {
							if (row.workflowRunId) {
								taskStatusesByRunId.set(
									row.workflowRunId,
									row.status as TaskRecordStatus,
								)
							}
						}
					}

					for (const run of runs) {
						if (cursorMs !== null && Date.parse(run.created_at) >= cursorMs)
							continue

						const task = applyTaskRecordStatus(
							serializeTask(run, gh.workspaceId),
							taskStatusesByRunId.get(String(run.id)),
						)
						if (status && task.status !== status) continue

						collected.push(task)
						if (collected.length >= limit + 1) break
					}

					if (runs.length < perPage) break
				} catch {
					return c.json({ error: "Failed to list workflow runs" }, 502)
				}
			}

			const hasMore = collected.length > limit
			const items = hasMore ? collected.slice(0, limit) : collected

			return c.json({
				tasks: items,
				hasMore,
				nextCursor: hasMore
					? (items[items.length - 1]?.createdAt ?? null)
					: null,
			})
		},
	)
	.get(
		"/:taskId",
		describeRoute({
			description: "Get a task and its full message history.",
			tags: ["tasks"],
			responses: {
				200: {
					description: "Task with message history",
					content: {
						"application/json": {
							schema: resolver(TaskDetailResponseSchema),
						},
					},
				},
				404: {
					description: "Task not found",
					content: {
						"application/json": { schema: resolver(TaskErrorSchema) },
					},
				},
			},
		}),
		async c => {
			const gh = await getGitHubContext(c)
			if (!gh) return c.json({ error: "GitHub token not found" }, 403)

			const taskId = c.req.param("taskId")!
			const runId = parseRunId(taskId)
			if (!runId) return c.json({ error: "Task not found" }, 404)

			const run = await fetchWorkflowRun(gh, runId)
			if (!run) return c.json({ error: "Task not found" }, 404)

			const db = c.get("db")

			// Fetch DB row, context, and outputs URL in parallel
			const [dbRow, outputs] = await Promise.all([
				db
					.select({
						id: tasksTable.id,
						lifecycle: tasksTable.lifecycle,
						status: tasksTable.status,
						output: tasksTable.output,
						payload: tasksTable.payload,
					})
					.from(tasksTable)
					.where(
						and(
							eq(tasksTable.workspaceId, gh.workspaceId),
							eq(tasksTable.workflowRunId, taskId),
						),
					)
					.limit(1)
					.then(rows => rows[0] ?? null),
				fetchRunOutputsUrl(gh, runId).catch(() => null),
			])

			const contextRows = dbRow
				? await db
						.select({
							source: taskContextTable.source,
							sourceId: taskContextTable.sourceId,
						})
						.from(taskContextTable)
						.where(eq(taskContextTable.taskId, dbRow.id))
				: []

			// Fire-and-forget: reconcile DB lifecycle with GitHub status
			if (dbRow) {
				const ghStatus = mapRunStatus(run)
				let targetLifecycle: Lifecycle | null = null
				if (
					ghStatus === "working" &&
					lifecycleRank[dbRow.lifecycle as Lifecycle] < lifecycleRank.started
				) {
					targetLifecycle = "started"
				} else if (
					TERMINAL_STATUSES.has(ghStatus) &&
					lifecycleRank[dbRow.lifecycle as Lifecycle] <
						lifecycleRank.workflow_complete
				) {
					targetLifecycle = "workflow_complete"
				}
				if (targetLifecycle) {
					db.update(tasksTable)
						.set({ lifecycle: targetLifecycle })
						.where(eq(tasksTable.id, dbRow.id))
						.catch(err =>
							console.error("Failed to reconcile task lifecycle:", err),
						)
				}
			}

			const task = applyTaskRecordStatus(
				serializeTask(run, gh.workspaceId),
				(dbRow?.status as TaskRecordStatus | undefined) ?? null,
			)

			return c.json({
				task,
				messages: serializeMessages(run),
				outputs,
				output: dbRow?.output ?? null,
				payload: (dbRow?.payload as Record<string, unknown>) ?? null,
				context: contextRows.map(r => ({
					source: r.source,
					source_id: r.sourceId,
				})),
			})
		},
	)
	.post(
		"/:taskId/archive",
		describeRoute({
			description:
				"Archive a terminal task so it remains visible but muted in task lists.",
			tags: ["tasks"],
			responses: {
				200: {
					description: "Task archived",
					content: {
						"application/json": {
							schema: resolver(ArchiveTaskResponseSchema),
						},
					},
				},
				404: {
					description: "Task not found",
					content: {
						"application/json": { schema: resolver(TaskErrorSchema) },
					},
				},
				409: {
					description: "Task cannot be archived yet",
					content: {
						"application/json": { schema: resolver(TaskErrorSchema) },
					},
				},
			},
		}),
		async c => {
			const gh = await getGitHubContext(c)
			if (!gh) return c.json({ error: "GitHub token not found" }, 403)

			const taskId = c.req.param("taskId")!
			const runId = parseRunId(taskId)
			if (!runId) return c.json({ error: "Task not found" }, 404)

			const run = await fetchWorkflowRun(gh, runId)
			if (!run) return c.json({ error: "Task not found" }, 404)

			const ghStatus = mapRunStatus(run)
			if (!TERMINAL_STATUSES.has(ghStatus)) {
				return c.json(
					{
						error: "Task can only be archived after it is completed or errored",
					},
					409,
				)
			}

			const db = c.get("db")
			const [existingTask] = await db
				.select({ id: tasksTable.id })
				.from(tasksTable)
				.where(
					and(
						eq(tasksTable.workspaceId, gh.workspaceId),
						eq(tasksTable.workflowRunId, taskId),
					),
				)
				.limit(1)

			if (existingTask) {
				await db
					.update(tasksTable)
					.set({ status: "archived" })
					.where(eq(tasksTable.id, existingTask.id))
			} else {
				await db.insert(tasksTable).values({
					workspaceId: gh.workspaceId,
					workflowRunId: taskId,
					lifecycle: "workflow_complete",
					status: "archived",
					payload: { prompt: derivePrompt(run) },
				})
			}

			return c.json({ ok: true, status: "archived" as const })
		},
	)
	.post(
		"/:taskId/unarchive",
		describeRoute({
			description:
				"Unarchive a task so it shows with its live workflow status.",
			tags: ["tasks"],
			responses: {
				200: {
					description: "Task unarchived",
					content: {
						"application/json": {
							schema: resolver(UnarchiveTaskResponseSchema),
						},
					},
				},
				404: {
					description: "Task not found",
					content: {
						"application/json": { schema: resolver(TaskErrorSchema) },
					},
				},
				409: {
					description: "Task cannot be unarchived yet",
					content: {
						"application/json": { schema: resolver(TaskErrorSchema) },
					},
				},
			},
		}),
		async c => {
			const gh = await getGitHubContext(c)
			if (!gh) return c.json({ error: "GitHub token not found" }, 403)

			const taskId = c.req.param("taskId")!
			const runId = parseRunId(taskId)
			if (!runId) return c.json({ error: "Task not found" }, 404)

			const run = await fetchWorkflowRun(gh, runId)
			if (!run) return c.json({ error: "Task not found" }, 404)

			const ghStatus = mapRunStatus(run)
			if (!TERMINAL_STATUSES.has(ghStatus)) {
				return c.json(
					{
						error:
							"Task can only be unarchived after it is completed or errored",
					},
					409,
				)
			}

			const db = c.get("db")
			const [existingTask] = await db
				.select({ id: tasksTable.id })
				.from(tasksTable)
				.where(
					and(
						eq(tasksTable.workspaceId, gh.workspaceId),
						eq(tasksTable.workflowRunId, taskId),
					),
				)
				.limit(1)

			if (!existingTask) {
				return c.json({ error: "Archived task not found" }, 404)
			}

			await db
				.update(tasksTable)
				.set({ status: "active" })
				.where(eq(tasksTable.id, existingTask.id))

			return c.json({ ok: true, status: "active" as const })
		},
	)
	.put(
		"/:taskId/lifecycle",
		describeRoute({
			description:
				"Update task lifecycle state (started, workflow_complete, outputs_stored).",
			tags: ["tasks"],
			responses: {
				200: {
					description: "Lifecycle updated",
					content: {
						"application/json": {
							schema: resolver(UpdateLifecycleResponseSchema),
						},
					},
				},
				404: {
					description: "Task not found",
					content: {
						"application/json": { schema: resolver(TaskErrorSchema) },
					},
				},
			},
		}),
		zValidator("json", UpdateLifecycleRequestSchema),
		async c => {
			const taskId = c.req.param("taskId")!
			const { lifecycle: newLifecycle, output } = c.req.valid("json")
			const db = c.get("db")
			const ws = c.get("workspace")

			const [task] = await db
				.select({
					id: tasksTable.id,
					lifecycle: tasksTable.lifecycle,
				})
				.from(tasksTable)
				.where(
					and(
						eq(tasksTable.workspaceId, ws.id),
						eq(tasksTable.workflowRunId, taskId),
					),
				)
				.limit(1)

			if (!task) {
				return c.json({ error: "Task not found" }, 404)
			}

			const currentRank = lifecycleRank[task.lifecycle as Lifecycle]
			const newRank = lifecycleRank[newLifecycle]

			// Forward-only: skip if already at or past this state
			if (newRank <= currentRank) {
				return c.json({ ok: true, lifecycle: task.lifecycle })
			}

			await db
				.update(tasksTable)
				.set({
					lifecycle: newLifecycle,
					...(output !== undefined && { output }),
				})
				.where(eq(tasksTable.id, task.id))

			return c.json({ ok: true, lifecycle: newLifecycle })
		},
	)

export default tasks
