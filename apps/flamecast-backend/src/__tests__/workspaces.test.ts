import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"
import type { Bindings } from "../index"

// Mock data
const TEST_USER_ID = "user_123"
const TEST_API_KEY_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
const TEST_WORKSPACE_ID = "11111111-2222-3333-4444-555555555555"

const mockWorkspace = {
	id: TEST_WORKSPACE_ID,
	userId: TEST_USER_ID,
	name: "test-ws",
	githubRepo: "testuser/flamecast-test-ws",
	status: "ready",
	config: { tools: [] },
	createdAt: new Date("2025-01-01"),
	updatedAt: new Date("2025-01-01"),
}

// Mocks
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
	users: { getAuthenticated: vi.fn() },
	repos: {
		get: vi.fn(),
		delete: vi.fn(),
		createForAuthenticatedUser: vi.fn(),
		createOrUpdateFileContents: vi.fn(),
		getContent: vi.fn(),
	},
	actions: {
		listRepoSecrets: vi.fn(),
		getRepoPublicKey: vi.fn(),
		createOrUpdateRepoSecret: vi.fn(),
		getRepoSecret: vi.fn(),
	},
}
const mockCreateConnectionToken = vi.fn(async () => "test_smithery_token")

vi.mock("../lib/octokit", () => ({
	getOctokit: vi.fn(() => mockOctokit),
}))

vi.mock("../lib/smithery", async importOriginal => {
	const actual = await importOriginal<typeof import("../lib/smithery")>()
	return {
		...actual,
		createSmitheryClient: vi.fn(() => ({})),
		createConnectionToken: mockCreateConnectionToken,
	}
})

vi.mock("../lib/github-secrets", () => ({
	encryptSecret: vi.fn(() => "encrypted_base64"),
}))

vi.mock("../lib/posthog", () => ({
	createPostHogClient: () => ({ capture: vi.fn() }),
}))

vi.mock("../lib/dispatch", () => ({
	dispatchWorkflow: vi.fn(async () => 12345),
}))

vi.mock("../lib/flamecast-workflow", () => ({
	FLAMECAST_WORKFLOW_PATH: ".github/workflows/flamecast.yml",
	getFlamecastWorkflowContentBase64: () => "base64content",
}))

// Import after mocks
const { default: workspaces } = await import("../routes/workspaces")

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

describe("GET /workspaces", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockOctokit.actions.listRepoSecrets.mockResolvedValue({
			data: { secrets: [] },
		})
	})

	it("returns 401 without auth", async () => {
		const app = createApp()
		const res = await app.request("/workspaces")
		expect(res.status).toBe(401)
	})

	it("returns workspace list", async () => {
		mockDb.select.mockReturnValue(chainMock([mockWorkspace]))

		const app = createApp()
		const res = await app.request("/workspaces", {
			headers: authHeaders,
		})

		expect(res.status).toBe(200)
		const body: any = await res.json()
		expect(body.workspaces).toHaveLength(1)
		expect(body.workspaces[0].name).toBe("test-ws")
		expect(body.workspaces[0].githubRepo).toBe("testuser/flamecast-test-ws")
		expect(body.workspaces[0].updatedAt).toBeDefined()
	})
})

describe("GET /workspaces/:workspaceId", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockOctokit.actions.listRepoSecrets.mockResolvedValue({
			data: { secrets: [] },
		})
	})

	it("returns 401 without auth", async () => {
		const app = createApp()
		const res = await app.request(`/workspaces/${TEST_WORKSPACE_ID}`)
		expect(res.status).toBe(401)
	})

	it("returns workspace detail", async () => {
		mockDb.select.mockReturnValue(chainMock([mockWorkspace]))

		const app = createApp()
		const res = await app.request(`/workspaces/${TEST_WORKSPACE_ID}`, {
			headers: authHeaders,
		})

		expect(res.status).toBe(200)
		const body: any = await res.json()
		expect(body.id).toBe(TEST_WORKSPACE_ID)
		expect(body.status).toBe("ready")
	})

	it("returns 404 for non-existent workspace", async () => {
		mockDb.select.mockReturnValue(chainMock([]))

		const app = createApp()
		const res = await app.request(
			`/workspaces/00000000-0000-0000-0000-000000000000`,
			{ headers: authHeaders },
		)

		expect(res.status).toBe(404)
	})

	it("returns 404 for another user's workspace", async () => {
		mockDb.select.mockReturnValue(
			chainMock([{ ...mockWorkspace, userId: "other_user" }]),
		)

		const app = createApp()
		const res = await app.request(`/workspaces/${TEST_WORKSPACE_ID}`, {
			headers: authHeaders,
		})

		expect(res.status).toBe(404)
	})
})

describe("DELETE /workspaces/:workspaceId", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockOctokit.repos.delete.mockResolvedValue({ status: 204 })
	})

	it("returns 401 without auth", async () => {
		const app = createApp()
		const res = await app.request(`/workspaces/${TEST_WORKSPACE_ID}`, {
			method: "DELETE",
		})
		expect(res.status).toBe(401)
	})

	it("deletes workspace", async () => {
		mockDb.select.mockReturnValue(chainMock([mockWorkspace]))
		mockDb.delete.mockReturnValue(chainMock([]))

		const app = createApp()
		const res = await app.request(`/workspaces/${TEST_WORKSPACE_ID}`, {
			method: "DELETE",
			headers: authHeaders,
		})

		expect(res.status).toBe(200)
		const body: any = await res.json()
		expect(body.success).toBe(true)
	})

	it("returns 404 for non-existent workspace", async () => {
		mockDb.select.mockReturnValue(chainMock([]))

		const app = createApp()
		const res = await app.request(`/workspaces/${TEST_WORKSPACE_ID}`, {
			method: "DELETE",
			headers: authHeaders,
		})

		expect(res.status).toBe(404)
	})
})

describe("POST /workspaces", () => {
	beforeEach(async () => {
		vi.clearAllMocks()
		const { RequestError } = await import("@octokit/request-error")
		mockOctokit.users.getAuthenticated.mockResolvedValue({
			data: { login: "testuser" },
		})
		// Repo doesn't exist yet
		mockOctokit.repos.get.mockRejectedValue(
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
		mockOctokit.repos.createForAuthenticatedUser.mockResolvedValue({
			data: { full_name: "testuser/flamecast-new-ws" },
		})
		mockOctokit.repos.createOrUpdateFileContents.mockResolvedValue({
			data: { content: { sha: "abc" } },
		})
		mockOctokit.actions.getRepoPublicKey.mockResolvedValue({
			data: { key: "base64pubkey==", key_id: "key-1" },
		})
		mockOctokit.actions.createOrUpdateRepoSecret.mockResolvedValue({
			status: 201,
		})
	})

	it("returns 401 without auth", async () => {
		const app = createApp()
		const res = await app.request("/workspaces", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "new-ws" }),
		})
		expect(res.status).toBe(401)
	})

	it("creates workspace", async () => {
		const created = {
			...mockWorkspace,
			id: "new-id",
			name: "new-ws",
			githubRepo: "testuser/flamecast-new-ws",
			status: "provisioning",
		}
		mockDb.insert.mockReturnValue(chainMock([created]))
		mockDb.update.mockReturnValue(chainMock([{ ...created, status: "ready" }]))

		const app = createApp()
		const res = await app.request("/workspaces", {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ name: "new-ws" }),
		})

		expect(res.status).toBe(200)
		const body: any = await res.json()
		expect(body.name).toBe("new-ws")
		expect(body.status).toBe("ready")
	})
})

describe("PUT /workspaces/:workspaceId/secrets", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockOctokit.actions.getRepoPublicKey.mockResolvedValue({
			data: { key: "base64pubkey==", key_id: "key-1" },
		})
		mockOctokit.actions.createOrUpdateRepoSecret.mockResolvedValue({
			status: 201,
		})
	})

	it("returns 401 without auth", async () => {
		const app = createApp()
		const res = await app.request(`/workspaces/${TEST_WORKSPACE_ID}/secrets`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ secrets: { MY_TOKEN: "abc123" } }),
		})
		expect(res.status).toBe(401)
	})

	it("returns 404 for non-existent workspace", async () => {
		mockDb.select.mockReturnValue(chainMock([]))

		const app = createApp()
		const res = await app.request(`/workspaces/${TEST_WORKSPACE_ID}/secrets`, {
			method: "PUT",
			headers: authHeaders,
			body: JSON.stringify({ secrets: { MY_TOKEN: "abc123" } }),
		})
		expect(res.status).toBe(404)
	})

	it("pushes secrets and returns success", async () => {
		mockDb.select.mockReturnValue(chainMock([mockWorkspace]))

		const app = createApp()
		const res = await app.request(`/workspaces/${TEST_WORKSPACE_ID}/secrets`, {
			method: "PUT",
			headers: authHeaders,
			body: JSON.stringify({ secrets: { MY_TOKEN: "abc123", OTHER: "xyz" } }),
		})

		expect(res.status).toBe(200)
		const body: any = await res.json()
		expect(body.success).toBe(true)
	})

	it("returns 500 when GitHub public key fetch fails", async () => {
		mockDb.select.mockReturnValue(chainMock([mockWorkspace]))
		const { RequestError } = await import("@octokit/request-error")
		mockOctokit.actions.getRepoPublicKey.mockRejectedValue(
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
		const res = await app.request(`/workspaces/${TEST_WORKSPACE_ID}/secrets`, {
			method: "PUT",
			headers: authHeaders,
			body: JSON.stringify({ secrets: { MY_TOKEN: "abc123" } }),
		})
		expect(res.status).toBe(500)
	})
})

describe("POST /workspaces/:workspaceId/secrets/refresh", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockOctokit.actions.getRepoPublicKey.mockResolvedValue({
			data: { key: "base64pubkey==", key_id: "key-1" },
		})
		mockOctokit.actions.createOrUpdateRepoSecret.mockResolvedValue({
			status: 201,
		})
	})

	it("returns 500 when SMITHERY_API_KEY refresh fails", async () => {
		mockDb.select.mockReturnValue(chainMock([mockWorkspace]))
		mockCreateConnectionToken.mockRejectedValueOnce(
			new Error("smithery unavailable"),
		)

		const app = createApp()
		const res = await app.request(
			`/workspaces/${TEST_WORKSPACE_ID}/secrets/refresh`,
			{
				method: "POST",
				headers: authHeaders,
			},
		)

		expect(res.status).toBe(500)
		const body: any = await res.json()
		expect(body.error).toBe("Failed to refresh SMITHERY_API_KEY")
		expect(mockOctokit.actions.createOrUpdateRepoSecret).not.toHaveBeenCalled()
	})
})
