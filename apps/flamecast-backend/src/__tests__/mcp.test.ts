import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"
import type { Bindings } from "../index"

const TEST_USER_ID = "user_123"
const TEST_API_KEY_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
const TEST_WORKSPACE_ID = "11111111-2222-3333-4444-555555555555"
const TEST_TASK_ID = "12345"

// ── Smithery mocks ──────────────────────────────────────────────

const mockAddConnection = vi.fn()
const mockListConnections = vi.fn()
const mockPreflightConnections = vi.fn()
const mockRemoveConnection = vi.fn()
const mockCreateConnectionToken = vi.fn()
const mockCreateConnectionSessionToken = vi.fn()

vi.mock("../lib/smithery", () => ({
	createSmitheryClient: () => ({}),
	addConnection: (...args: unknown[]) => mockAddConnection(...args),
	listConnections: (...args: unknown[]) => mockListConnections(...args),
	preflightConnections: (...args: unknown[]) =>
		mockPreflightConnections(...args),
	removeConnection: (...args: unknown[]) => mockRemoveConnection(...args),
	createConnectionToken: (...args: unknown[]) =>
		mockCreateConnectionToken(...args),
	createConnectionSessionToken: (...args: unknown[]) =>
		mockCreateConnectionSessionToken(...args),
	resolveServerUrl: (server: string) =>
		server.startsWith("http")
			? server
			: `https://server.smithery.ai/${server}/mcp`,
	resolveServerSlug: (mcpUrl: string) => {
		const prefix = "https://server.smithery.ai/"
		const suffix = "/mcp"
		if (mcpUrl.startsWith(prefix) && mcpUrl.endsWith(suffix)) {
			return mcpUrl.slice(prefix.length, -suffix.length)
		}
		return mcpUrl
	},
}))

// ── DB mock ─────────────────────────────────────────────────────

let currentWorkspace: Record<string, unknown> | null = null

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

const mockDb = {
	select: vi.fn(() => chainMock(currentWorkspace ? [currentWorkspace] : [])),
	insert: vi.fn(() => chainMock([])),
	update: vi.fn(() => chainMock([])),
	delete: vi.fn(() => chainMock([])),
}

vi.mock("../lib/db", () => ({
	createDbFromUrl: () => mockDb,
}))

// ── Auth mock ───────────────────────────────────────────────────

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

vi.mock("../lib/octokit", () => ({
	getOctokit: vi.fn(() => ({})),
}))

// ── Other mocks ─────────────────────────────────────────────────

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

const mockDispatchWorkflow = vi.fn<(...args: any[]) => any>(async () => ({
	dispatched: true,
	workflowRunId: Number(TEST_TASK_ID),
}))

vi.mock("../lib/dispatch", () => ({
	dispatchWorkflow: (...args: any[]) => mockDispatchWorkflow(...args),
}))

// ── Import routes after mocks ───────────────────────────────────

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
	SMITHERY_API_KEY: "test_smithery_key",
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

const mcpPath = `/workspaces/${TEST_WORKSPACE_ID}/mcp`
const taskPath = `/workspaces/${TEST_WORKSPACE_ID}/tasks`

// ── Tests ───────────────────────────────────────────────────────

describe("MCP connection flows", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		currentWorkspace = null
	})

	describe("add connection", () => {
		it("returns ready connection from addConnection", async () => {
			currentWorkspace = {
				id: TEST_WORKSPACE_ID,
				userId: TEST_USER_ID,
				name: "test-ws",
				githubRepo: "testuser/test-ws",
				status: "ready",
				config: { tools: [] },
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			mockAddConnection.mockResolvedValue({
				status: "ready",
				connectionId: "linear-abc",
			})

			const app = createApp()
			const res = await app.request(mcpPath, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ server: "linear" }),
			})

			expect(res.status).toBe(200)
			const body: any = await res.json()
			expect(body.connection.status).toBe("ready")
			expect(body.connection.connectionId).toBe("linear-abc")

			// Verify addConnection was called with correct args
			expect(mockAddConnection).toHaveBeenCalledWith(
				expect.anything(),
				"linear",
				TEST_WORKSPACE_ID,
				undefined,
			)
		})
	})

	describe("auth_required → re-verify with connectionId", () => {
		it("returns auth_required, then ready on re-verify", async () => {
			currentWorkspace = {
				id: TEST_WORKSPACE_ID,
				userId: TEST_USER_ID,
				name: "test-ws",
				githubRepo: "testuser/test-ws",
				status: "ready",
				config: { tools: [] },
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			// Step 1: First add returns auth_required
			mockAddConnection.mockResolvedValue({
				status: "auth_required",
				authorizationUrl: "https://smithery.ai/auth/linear-xyz",
				connectionId: "linear-xyz",
			})

			const app = createApp()
			const res1 = await app.request(mcpPath, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ server: "linear" }),
			})

			expect(res1.status).toBe(200)
			const body1: any = await res1.json()
			expect(body1.connection.status).toBe("auth_required")
			expect(body1.connection.connectionId).toBe("linear-xyz")
			expect(body1.connection.authorizationUrl).toBe(
				"https://smithery.ai/auth/linear-xyz",
			)

			// Step 2: Re-verify after OAuth (same connectionId, now returns ready)
			vi.clearAllMocks()

			mockAddConnection.mockResolvedValue({
				status: "ready",
				connectionId: "linear-xyz",
			})

			const res2 = await app.request(mcpPath, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({
					server: "linear",
					connectionId: "linear-xyz",
				}),
			})

			expect(res2.status).toBe(200)
			const body2: any = await res2.json()
			expect(body2.connection.status).toBe("ready")

			// Verify addConnection was called with the existing connectionId
			expect(mockAddConnection).toHaveBeenCalledWith(
				expect.anything(),
				"linear",
				TEST_WORKSPACE_ID,
				"linear-xyz",
			)
		})
	})

	describe("list connections", () => {
		it("returns connections from Smithery API", async () => {
			currentWorkspace = {
				id: TEST_WORKSPACE_ID,
				userId: TEST_USER_ID,
				name: "test-ws",
				githubRepo: "testuser/test-ws",
				status: "ready",
				config: { tools: [] },
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			mockListConnections.mockResolvedValue([
				{
					connectionId: "linear-abc",
					mcpUrl: "https://server.smithery.ai/linear/mcp",
					name: "linear",
					metadata: { workspaceId: TEST_WORKSPACE_ID },
					status: { state: "connected" },
				},
				{
					connectionId: "gh-def",
					mcpUrl: "https://server.smithery.ai/github/mcp",
					name: "github",
					metadata: { workspaceId: TEST_WORKSPACE_ID },
					status: { state: "connected" },
				},
			])

			const app = createApp()
			const res = await app.request(mcpPath, {
				method: "GET",
				headers: authHeaders,
			})

			expect(res.status).toBe(200)
			const body: any = await res.json()
			expect(body.connections).toHaveLength(2)
			expect(body.connections[0].server).toBe("linear")
			expect(body.connections[0].mcpUrl).toBe(
				"https://server.smithery.ai/linear/mcp",
			)
			expect(body.connections[0].status).toBe("ready")
			expect(body.connections[1].server).toBe("github")
		})
	})

	describe("mint short-lived session token", () => {
		it("returns a scoped Smithery token", async () => {
			currentWorkspace = {
				id: TEST_WORKSPACE_ID,
				userId: TEST_USER_ID,
				name: "test-ws",
				githubRepo: "testuser/test-ws",
				status: "ready",
				config: { tools: [] },
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			mockCreateConnectionSessionToken.mockResolvedValue({
				token: "smithery_short_lived_token",
				expiresAt: "2026-02-25T23:30:00.000Z",
			})

			const app = createApp()
			const res = await app.request(`${mcpPath}/token`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({}),
			})

			expect(res.status).toBe(200)
			const body: any = await res.json()
			expect(body.token).toBe("smithery_short_lived_token")
			expect(body.expiresAt).toBe("2026-02-25T23:30:00.000Z")
			expect(mockCreateConnectionSessionToken).toHaveBeenCalledWith(
				expect.anything(),
				TEST_WORKSPACE_ID,
				300,
			)
		})

		it("accepts a custom ttlSeconds up to 300", async () => {
			currentWorkspace = {
				id: TEST_WORKSPACE_ID,
				userId: TEST_USER_ID,
				name: "test-ws",
				githubRepo: "testuser/test-ws",
				status: "ready",
				config: { tools: [] },
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			mockCreateConnectionSessionToken.mockResolvedValue({
				token: "smithery_custom_ttl_token",
				expiresAt: "2026-02-25T23:28:00.000Z",
			})

			const app = createApp()
			const res = await app.request(`${mcpPath}/token`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ ttlSeconds: 120 }),
			})

			expect(res.status).toBe(200)
			expect(mockCreateConnectionSessionToken).toHaveBeenCalledWith(
				expect.anything(),
				TEST_WORKSPACE_ID,
				120,
			)
		})

		it("rejects ttlSeconds greater than 300", async () => {
			currentWorkspace = {
				id: TEST_WORKSPACE_ID,
				userId: TEST_USER_ID,
				name: "test-ws",
				githubRepo: "testuser/test-ws",
				status: "ready",
				config: { tools: [] },
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			const app = createApp()
			const res = await app.request(`${mcpPath}/token`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ ttlSeconds: 301 }),
			})

			expect(res.status).toBe(400)
			expect(mockCreateConnectionSessionToken).not.toHaveBeenCalled()
		})
	})

	describe("delete connection", () => {
		it("finds and removes connection via Smithery API", async () => {
			currentWorkspace = {
				id: TEST_WORKSPACE_ID,
				userId: TEST_USER_ID,
				name: "test-ws",
				githubRepo: "testuser/test-ws",
				status: "ready",
				config: { tools: [] },
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			mockListConnections.mockResolvedValue([
				{
					connectionId: "linear-abc",
					mcpUrl: "https://server.smithery.ai/linear/mcp",
					name: "linear",
					metadata: { workspaceId: TEST_WORKSPACE_ID },
					status: { state: "connected" },
				},
			])

			const app = createApp()
			const res = await app.request(`${mcpPath}/linear`, {
				method: "DELETE",
				headers: authHeaders,
			})

			expect(res.status).toBe(200)
			const body: any = await res.json()
			expect(body.success).toBe(true)

			expect(mockRemoveConnection).toHaveBeenCalledWith(
				expect.anything(),
				"linear-abc",
			)
		})

		it("returns 404 when connection not found", async () => {
			currentWorkspace = {
				id: TEST_WORKSPACE_ID,
				userId: TEST_USER_ID,
				name: "test-ws",
				githubRepo: "testuser/test-ws",
				status: "ready",
				config: { tools: [] },
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			mockListConnections.mockResolvedValue([])

			const app = createApp()
			const res = await app.request(`${mcpPath}/linear`, {
				method: "DELETE",
				headers: authHeaders,
			})

			expect(res.status).toBe(404)
		})
	})
})

describe("Task dispatch with MCP preflight", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		currentWorkspace = null
	})

	it("returns 428 when connections need OAuth authorization", async () => {
		currentWorkspace = {
			id: TEST_WORKSPACE_ID,
			userId: TEST_USER_ID,
			name: "test-ws",
			githubRepo: "testuser/test-ws",
			status: "ready",
			config: { tools: [] },
			createdAt: new Date(),
			updatedAt: new Date(),
		}

		const testConnectionsList = [
			{
				connectionId: "linear-abc",
				mcpUrl: "https://server.smithery.ai/linear/mcp",
				name: "linear",
				metadata: { workspaceId: TEST_WORKSPACE_ID },
				status: {
					state: "auth_required" as const,
					authorizationUrl: "https://smithery.ai/auth/linear-abc",
				},
			},
		]

		mockListConnections.mockResolvedValue(testConnectionsList)

		mockPreflightConnections.mockReturnValue({
			ready: [],
			authRequired: [
				{
					server: "linear",
					authorizationUrl: "https://smithery.ai/auth/linear-abc",
				},
			],
			errors: [],
		})

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status: 200 })),
		)

		const app = createApp()
		const res = await app.request(taskPath, {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ prompt: "list my tickets" }),
		})

		expect(res.status).toBe(428)
		const body: any = await res.json()
		expect(body.authRequired).toHaveLength(1)
		expect(body.authRequired[0].server).toBe("linear")
		expect(body.authRequired[0].authorizationUrl).toBe(
			"https://smithery.ai/auth/linear-abc",
		)

		// Dispatch should NOT have been called
		expect(mockDispatchWorkflow).not.toHaveBeenCalled()
	})

	it("dispatches with connections in payload when all connections are ready", async () => {
		const testConnectionsList = [
			{
				connectionId: "linear-abc",
				mcpUrl: "https://server.smithery.ai/linear/mcp",
				name: "linear",
				metadata: { workspaceId: TEST_WORKSPACE_ID },
				status: { state: "connected" as const },
			},
			{
				connectionId: "gh-def",
				mcpUrl: "https://server.smithery.ai/github/mcp",
				name: "github",
				metadata: { workspaceId: TEST_WORKSPACE_ID },
				status: { state: "connected" as const },
			},
		]

		currentWorkspace = {
			id: TEST_WORKSPACE_ID,
			userId: TEST_USER_ID,
			name: "test-ws",
			githubRepo: "testuser/test-ws",
			status: "ready",
			config: { tools: [] },
			createdAt: new Date(),
			updatedAt: new Date(),
		}

		mockListConnections.mockResolvedValue(testConnectionsList)

		mockPreflightConnections.mockReturnValue({
			ready: ["linear", "github"],
			authRequired: [],
			errors: [],
		})

		// Mock the dispatch and the run lookup
		mockDispatchWorkflow.mockResolvedValue({
			dispatched: true,
			workflowRunId: Number(TEST_TASK_ID),
		})

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const url = input.toString()
				if (url.includes(`/actions/runs/${TEST_TASK_ID}`)) {
					return new Response(
						JSON.stringify({
							id: Number(TEST_TASK_ID),
							name: "Flamecast",
							display_title: "list my tickets",
							status: "in_progress",
							conclusion: null,
							created_at: "2025-01-01T00:00:00Z",
							updated_at: "2025-01-01T00:01:00Z",
							run_started_at: "2025-01-01T00:00:10Z",
							path: ".github/workflows/flamecast.yml",
						}),
						{ status: 200 },
					)
				}
				return new Response(null, { status: 200 })
			}),
		)

		const app = createApp()
		const res = await app.request(taskPath, {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ prompt: "list my tickets" }),
		})

		expect(res.status).toBe(200)

		// Verify preflight was called with the Connection[] array
		expect(mockPreflightConnections).toHaveBeenCalledWith(testConnectionsList)

		// Verify dispatch payload does NOT include connections (CLI discovers them)
		expect(mockDispatchWorkflow).toHaveBeenCalledTimes(1)
		const dispatchArgs = mockDispatchWorkflow.mock.lastCall as unknown as [
			{ inputs: Record<string, string> },
		]
		const payload = JSON.parse(dispatchArgs[0].inputs.payload)
		expect(payload.connections).toBeUndefined()
		expect(payload.prompt).toBe("list my tickets")
	})
})
