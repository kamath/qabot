import { describe, it, expect, vi, beforeEach } from "vitest"

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

const { authenticateBearer } = await import("../lib/auth")
const { ensurePersonalOrganization } = await import("../lib/org")

describe("authenticateBearer", () => {
	const mockWorkos = {
		apiKeys: {
			validateApiKey: vi.fn(),
		},
		userManagement: {
			getJWKS: vi.fn().mockResolvedValue(null),
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("returns null when authHeader is undefined", async () => {
		const result = await authenticateBearer(
			mockDb as any,
			undefined,
			mockWorkos as any,
		)
		expect(result).toBeNull()
	})

	it("returns null when authHeader has no Bearer prefix", async () => {
		const result = await authenticateBearer(
			mockDb as any,
			"Basic abc123",
			mockWorkos as any,
		)
		expect(result).toBeNull()
	})

	it("returns null when WorkOS returns no apiKey", async () => {
		mockWorkos.apiKeys.validateApiKey.mockResolvedValue({ apiKey: null })

		const result = await authenticateBearer(
			mockDb as any,
			"Bearer sk_test_token",
			mockWorkos as any,
		)
		expect(result).toBeNull()
	})

	it("returns null when no org mapping exists", async () => {
		mockWorkos.apiKeys.validateApiKey.mockResolvedValue({
			apiKey: { owner: { id: "org_123" } },
		})
		mockDb.select.mockReturnValue(chainMock([]))

		const result = await authenticateBearer(
			mockDb as any,
			"Bearer sk_test_token",
			mockWorkos as any,
		)
		expect(result).toBeNull()
	})

	it("returns userId when validation succeeds and org mapping exists", async () => {
		mockWorkos.apiKeys.validateApiKey.mockResolvedValue({
			apiKey: { owner: { id: "org_123" } },
		})
		mockDb.select.mockReturnValue(chainMock([{ userId: "user_abc" }]))

		const result = await authenticateBearer(
			mockDb as any,
			"Bearer sk_test_token",
			mockWorkos as any,
		)
		expect(result).toEqual({ userId: "user_abc" })
	})

	it("returns null when WorkOS throws", async () => {
		mockWorkos.apiKeys.validateApiKey.mockRejectedValue(
			new Error("WorkOS error"),
		)

		const result = await authenticateBearer(
			mockDb as any,
			"Bearer sk_invalid",
			mockWorkos as any,
		)
		expect(result).toBeNull()
	})

	it("uses cache on second call within TTL", async () => {
		mockWorkos.apiKeys.validateApiKey.mockResolvedValue({
			apiKey: { owner: { id: "org_123" } },
		})
		mockDb.select.mockReturnValue(chainMock([{ userId: "user_abc" }]))

		const cacheToken = `sk_cache_test_${Date.now()}`
		const header = `Bearer ${cacheToken}`

		// First call hits WorkOS
		await authenticateBearer(mockDb as any, header, mockWorkos as any)
		expect(mockWorkos.apiKeys.validateApiKey).toHaveBeenCalledTimes(1)

		// Second call should use cache
		const result = await authenticateBearer(
			mockDb as any,
			header,
			mockWorkos as any,
		)
		expect(result).toEqual({ userId: "user_abc" })
		expect(mockWorkos.apiKeys.validateApiKey).toHaveBeenCalledTimes(1)
	})
})

describe("ensurePersonalOrganization", () => {
	const mockWorkos = {
		organizations: {
			createOrganization: vi.fn(),
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("returns existing org when mapping exists", async () => {
		mockDb.select.mockReturnValue(
			chainMock([{ organizationId: "org_existing" }]),
		)

		const result = await ensurePersonalOrganization(
			mockWorkos as any,
			mockDb as any,
			"user_1",
			"user@example.com",
		)

		expect(result).toBe("org_existing")
		expect(mockWorkos.organizations.createOrganization).not.toHaveBeenCalled()
	})

	it("creates new org and inserts mapping when none exists", async () => {
		mockDb.select.mockReturnValue(chainMock([]))
		mockWorkos.organizations.createOrganization.mockResolvedValue({
			id: "org_new",
		})
		mockDb.insert.mockReturnValue(chainMock([]))

		const result = await ensurePersonalOrganization(
			mockWorkos as any,
			mockDb as any,
			"user_1",
			"user@example.com",
		)

		expect(result).toBe("org_new")
		expect(mockWorkos.organizations.createOrganization).toHaveBeenCalledWith({
			name: "user@example.com's org",
		})
	})
})
