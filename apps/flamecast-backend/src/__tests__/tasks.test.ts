import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"
import type { Bindings } from "../index"

const TEST_USER_ID = "user_123"
const TEST_API_KEY_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
const TEST_WORKSPACE_ID = "11111111-2222-3333-4444-555555555555"
const TEST_TASK_ID = "12345"

const mockWorkspace = {
	id: TEST_WORKSPACE_ID,
	userId: TEST_USER_ID,
	name: "test-ws",
	githubRepo: "testuser/flamecast-test-ws",
	status: "ready",
	config: {},
	createdAt: new Date("2025-01-01"),
	updatedAt: new Date("2025-01-01"),
}

const baseRun = {
	id: Number(TEST_TASK_ID),
	name: "Flamecast",
	display_title: "test prompt",
	status: "in_progress",
	conclusion: null,
	created_at: "2025-01-01T00:00:00.000Z",
	updated_at: "2025-01-01T00:01:00.000Z",
	run_started_at: "2025-01-01T00:00:10.000Z",
	path: ".github/workflows/flamecast.yml",
}

const mockDb = {
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}

function chainMock(result: unknown[]) {
	const chain: Record<string, unknown> = {}
	const proxy = new Proxy(chain, {
		get(_target, prop) {
			if (prop === "then") {
				return (resolve: (v: unknown) => void) => resolve(result)
			}
			return () => proxy
		},
	})
	return proxy
}

vi.mock("../lib/db", () => ({
	createDbFromUrl: () => mockDb,
}))

vi.mock("../lib/auth", () => ({
	authenticateBearer: vi.fn(
		async (_db: unknown, authHeader: string | undefined) => {
			if (!authHeader) return null
			if (authHeader === `Bearer ${TEST_API_KEY_UUID}`)
				return { id: "ak-1", userId: TEST_USER_ID }
			return null
		},
	),
	getGitHubAccessToken: vi.fn(async () => "gh_test_token"),
}))

const mockOctokit = {
	actions: {
		getWorkflowRun: vi.fn(),
		listWorkflowRuns: vi.fn(),
		createWorkflowDispatch: vi.fn(),
	},
	repos: {
		get: vi.fn(),
		getContent: vi.fn(),
	},
	users: {
		getAuthenticated: vi.fn(),
	},
}

vi.mock("../lib/octokit", () => ({
	getOctokit: vi.fn(() => mockOctokit),
}))

vi.mock("../lib/dispatch", () => ({
	dispatchWorkflow: vi.fn(async () => ({
		dispatched: true,
		workflowRunId: Number(TEST_TASK_ID),
	})),
}))

vi.mock("../lib/github-secrets", () => ({
	encryptSecret: vi.fn(() => "encrypted_base64"),
}))

vi.mock("../lib/posthog", () => ({
	createPostHogClient: () => ({ capture: vi.fn() }),
}))

vi.mock("../lib/flamecast-workflow", () => ({
	FLAMECAST_WORKFLOW_PATH: ".github/workflows/flamecast.yml",
	getFlamecastWorkflowContentBase64: () => "base64content",
}))

const { default: workspaces } = await import("../routes/workspaces")

const testEnv: Bindings = {
	HYPERDRIVE: {
		connectionString: "postgresql://test",
	} as unknown as Hyperdrive,
	WORKOS_API_KEY: "test",
	WORKOS_CLIENT_ID: "test",
	WORKOS_COOKIE_PASSWORD: "test",
	WORKOS_REDIRECT_URI: "test",
	POSTHOG_KEY: "test",
	POSTHOG_HOST: "test",
	SMITHERY_API_KEY: "test",
	AGENTMAIL_API_KEY: "test",
	AGENTMAIL_INBOX_ID: "test",
}

function createApp() {
	const app = new Hono<{ Bindings: Bindings }>()
	app.use("*", async (c, next) => {
		c.env = testEnv
		await next()
	})
	app.route("/workspaces", workspaces)
	return app
}

const authHeaders = {
	Authorization: `Bearer ${TEST_API_KEY_UUID}`,
	"Content-Type": "application/json",
}

const taskPath = `/workspaces/${TEST_WORKSPACE_ID}/tasks`

describe("POST /workspaces/:workspaceId/tasks", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockOctokit.actions.getWorkflowRun.mockResolvedValue({ data: baseRun })
	})

	it("returns 401 without auth", async () => {
		const app = createApp()
		const res = await app.request(taskPath, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ prompt: "do something" }),
		})
		expect(res.status).toBe(401)
	})

	it("returns 404 for non-existent workspace", async () => {
		mockDb.select.mockReturnValue(chainMock([]))

		const app = createApp()
		const res = await app.request(taskPath, {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ prompt: "do something" }),
		})
		expect(res.status).toBe(404)
	})

	it("creates task from GitHub workflow run", async () => {
		mockDb.select.mockReturnValue(chainMock([mockWorkspace]))

		const app = createApp()
		const res = await app.request(taskPath, {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ prompt: "do something" }),
		})

		expect(res.status).toBe(200)
		const body: any = await res.json()
		expect(body.workspaceId).toBe(TEST_WORKSPACE_ID)
		expect(body.id).toBe(TEST_TASK_ID)
		expect(body.status).toBe("working")
	})
})

describe("GET /workspaces/:workspaceId/tasks", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockOctokit.actions.listWorkflowRuns.mockResolvedValue({
			data: { workflow_runs: [baseRun] },
		})
	})

	it("returns 401 without auth", async () => {
		const app = createApp()
		const res = await app.request(taskPath)
		expect(res.status).toBe(401)
	})

	it("returns task list", async () => {
		mockDb.select.mockReturnValue(chainMock([mockWorkspace]))

		const app = createApp()
		const res = await app.request(taskPath, { headers: authHeaders })

		expect(res.status).toBe(200)
		const body: any = await res.json()
		expect(body.tasks).toHaveLength(1)
		expect(body.tasks[0].id).toBe(TEST_TASK_ID)
		expect(body.hasMore).toBe(false)
	})

	it("returns 404 for non-existent workspace", async () => {
		mockDb.select.mockReturnValue(chainMock([]))

		const app = createApp()
		const res = await app.request(taskPath, { headers: authHeaders })
		expect(res.status).toBe(404)
	})
})

describe("GET /workspaces/:workspaceId/tasks/:taskId", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockOctokit.actions.getWorkflowRun.mockResolvedValue({ data: baseRun })
		mockOctokit.repos.getContent.mockResolvedValue({
			data: [
				{
					type: "file",
					name: "FULL_EXECUTION_LOG.md",
					path: `runs/${TEST_TASK_ID}/outputs/FULL_EXECUTION_LOG.md`,
				},
			],
		})
	})

	it("returns task with synthetic message history", async () => {
		mockDb.select.mockReturnValue(chainMock([mockWorkspace]))

		const app = createApp()
		const res = await app.request(`${taskPath}/${TEST_TASK_ID}`, {
			headers: authHeaders,
		})

		expect(res.status).toBe(200)
		const body: any = await res.json()
		expect(body.task.id).toBe(TEST_TASK_ID)
		expect(body.messages).toHaveLength(1)
		expect(body.messages[0].role).toBe("user")
		expect(body.outputs).toBe(
			`https://github.com/testuser/flamecast-test-ws/tree/HEAD/runs/${TEST_TASK_ID}`,
		)
	})

	it("returns 404 for non-existent task", async () => {
		mockDb.select.mockReturnValue(chainMock([mockWorkspace]))
		const { RequestError } = await import("@octokit/request-error")
		mockOctokit.actions.getWorkflowRun.mockRejectedValue(
			new RequestError("Not Found", 404, {
				request: { method: "GET", url: "", headers: {} },
				response: {
					status: 404,
					url: "",
					headers: {},
					data: { message: "Not Found" },
					retryCount: 0,
				},
			}),
		)

		const app = createApp()
		const res = await app.request(`${taskPath}/${TEST_TASK_ID}`, {
			headers: authHeaders,
		})
		expect(res.status).toBe(404)
	})
})

describe("POST /workspaces/:workspaceId/tasks/:taskId/archive", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("archives a completed task", async () => {
		mockDb.select
			.mockReturnValueOnce(chainMock([mockWorkspace]))
			.mockReturnValueOnce(chainMock([]))
		mockDb.insert.mockReturnValue(chainMock([]))
		mockOctokit.actions.getWorkflowRun.mockResolvedValue({
			data: {
				...baseRun,
				status: "completed",
				conclusion: "success",
			},
		})

		const app = createApp()
		const res = await app.request(`${taskPath}/${TEST_TASK_ID}/archive`, {
			method: "POST",
			headers: authHeaders,
		})

		expect(res.status).toBe(200)
		const body: any = await res.json()
		expect(body.ok).toBe(true)
		expect(body.status).toBe("archived")
	})

	it("rejects archive for non-terminal tasks", async () => {
		mockDb.select.mockReturnValue(chainMock([mockWorkspace]))
		mockOctokit.actions.getWorkflowRun.mockResolvedValue({
			data: {
				...baseRun,
				status: "in_progress",
				conclusion: null,
			},
		})

		const app = createApp()
		const res = await app.request(`${taskPath}/${TEST_TASK_ID}/archive`, {
			method: "POST",
			headers: authHeaders,
		})

		expect(res.status).toBe(409)
		const body: any = await res.json()
		expect(body.error).toContain("completed or errored")
	})
})

describe("POST /workspaces/:workspaceId/tasks/:taskId/unarchive", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("unarchives an archived task", async () => {
		mockDb.select
			.mockReturnValueOnce(chainMock([mockWorkspace]))
			.mockReturnValueOnce(chainMock([{ id: "row-1" }]))
		mockDb.update.mockReturnValue(chainMock([]))
		mockOctokit.actions.getWorkflowRun.mockResolvedValue({
			data: {
				...baseRun,
				status: "completed",
				conclusion: "success",
			},
		})

		const app = createApp()
		const res = await app.request(`${taskPath}/${TEST_TASK_ID}/unarchive`, {
			method: "POST",
			headers: authHeaders,
		})

		expect(res.status).toBe(200)
		const body: any = await res.json()
		expect(body.ok).toBe(true)
		expect(body.status).toBe("active")
	})

	it("returns 404 when archived row does not exist", async () => {
		mockDb.select
			.mockReturnValueOnce(chainMock([mockWorkspace]))
			.mockReturnValueOnce(chainMock([]))
		mockOctokit.actions.getWorkflowRun.mockResolvedValue({
			data: {
				...baseRun,
				status: "completed",
				conclusion: "success",
			},
		})

		const app = createApp()
		const res = await app.request(`${taskPath}/${TEST_TASK_ID}/unarchive`, {
			method: "POST",
			headers: authHeaders,
		})

		expect(res.status).toBe(404)
	})
})
