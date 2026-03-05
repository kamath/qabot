import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"
import type { Bindings } from "../index"

const TEST_USER_ID = "user_123"
const TEST_API_KEY_TOKEN = "sk_test_key_value"
const TEST_ORG_ID = "org_456"

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

const mockListOrganizationApiKeys = vi.fn()
const mockCreateOrganizationApiKey = vi.fn()
const mockDeleteApiKey = vi.fn()

vi.mock("@workos-inc/node", () => {
	class MockWorkOS {
		organizations = {
			listOrganizationApiKeys: mockListOrganizationApiKeys,
			createOrganizationApiKey: mockCreateOrganizationApiKey,
		}
		apiKeys = {
			deleteApiKey: mockDeleteApiKey,
		}
	}
	return { WorkOS: MockWorkOS }
})

vi.mock("../lib/auth", () => ({
	authenticateBearer: vi.fn(
		async (_db: unknown, authHeader: string | undefined) => {
			if (!authHeader) return null
			if (authHeader === `Bearer ${TEST_API_KEY_TOKEN}`)
				return { userId: TEST_USER_ID }
			return null
		},
	),
}))

const { default: apiKeysRouter } = await import("../routes/api-keys")

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
	app.route("/api-keys", apiKeysRouter)
	return app
}

const authHeaders = {
	Authorization: `Bearer ${TEST_API_KEY_TOKEN}`,
	"Content-Type": "application/json",
}

describe("GET /api-keys", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("returns 401 without auth", async () => {
		const app = createApp()
		const res = await app.request("/api-keys")
		expect(res.status).toBe(401)
	})

	it("returns empty keys when no org mapping exists", async () => {
		mockDb.select.mockReturnValue(chainMock([]))

		const app = createApp()
		const res = await app.request("/api-keys", { headers: authHeaders })

		expect(res.status).toBe(200)
		const body = (await res.json()) as { keys: unknown[] }
		expect(body.keys).toEqual([])
	})

	it("returns keys from WorkOS when org exists", async () => {
		mockDb.select.mockReturnValue(chainMock([{ organizationId: TEST_ORG_ID }]))
		mockListOrganizationApiKeys.mockResolvedValue({
			data: [
				{
					id: "key_1",
					name: "Test Key",
					obfuscatedValue: "sk_...abc",
					createdAt: "2025-01-01T00:00:00Z",
					lastUsedAt: null,
				},
			],
		})

		const app = createApp()
		const res = await app.request("/api-keys", { headers: authHeaders })

		expect(res.status).toBe(200)
		const body = (await res.json()) as {
			keys: { id: string; name: string; obfuscatedValue: string }[]
		}
		expect(body.keys).toHaveLength(1)
		expect(body.keys[0].id).toBe("key_1")
		expect(body.keys[0].name).toBe("Test Key")
		expect(body.keys[0].obfuscatedValue).toBe("sk_...abc")
	})
})

describe("POST /api-keys", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("returns 401 without auth", async () => {
		const app = createApp()
		const res = await app.request("/api-keys", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "My Key" }),
		})
		expect(res.status).toBe(401)
	})

	it("returns 500 when no org mapping exists", async () => {
		mockDb.select.mockReturnValue(chainMock([]))

		const app = createApp()
		const res = await app.request("/api-keys", {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ name: "My Key" }),
		})

		expect(res.status).toBe(500)
	})

	it("creates API key via WorkOS", async () => {
		mockDb.select.mockReturnValue(chainMock([{ organizationId: TEST_ORG_ID }]))
		mockCreateOrganizationApiKey.mockResolvedValue({
			id: "key_new",
			value: "sk_new_key_value",
		})

		const app = createApp()
		const res = await app.request("/api-keys", {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ name: "My Key" }),
		})

		expect(res.status).toBe(200)
		const body = (await res.json()) as { key: string; id: string }
		expect(body.key).toBe("sk_new_key_value")
		expect(body.id).toBe("key_new")
		expect(mockCreateOrganizationApiKey).toHaveBeenCalledWith({
			organizationId: TEST_ORG_ID,
			name: "My Key",
		})
	})

	it("uses default name when none provided", async () => {
		mockDb.select.mockReturnValue(chainMock([{ organizationId: TEST_ORG_ID }]))
		mockCreateOrganizationApiKey.mockResolvedValue({
			id: "key_new",
			value: "sk_new_key_value",
		})

		const app = createApp()
		const res = await app.request("/api-keys", {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({}),
		})

		expect(res.status).toBe(200)
		expect(mockCreateOrganizationApiKey).toHaveBeenCalledWith({
			organizationId: TEST_ORG_ID,
			name: "API Key",
		})
	})
})

describe("DELETE /api-keys/:id", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("returns 401 without auth", async () => {
		const app = createApp()
		const res = await app.request("/api-keys/key_1", {
			method: "DELETE",
		})
		expect(res.status).toBe(401)
	})

	it("deletes API key via WorkOS", async () => {
		mockDeleteApiKey.mockResolvedValue(undefined)

		const app = createApp()
		const res = await app.request("/api-keys/key_1", {
			method: "DELETE",
			headers: authHeaders,
		})

		expect(res.status).toBe(200)
		const body = (await res.json()) as { success: boolean }
		expect(body.success).toBe(true)
		expect(mockDeleteApiKey).toHaveBeenCalledWith("key_1")
	})
})
