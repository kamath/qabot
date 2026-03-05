// Mock user/auth data
export const TEST_USER_ID = "user_test_123"
export const TEST_API_KEY = "00000000-0000-0000-0000-000000000001"
export const TEST_WORKSPACE_ID = "00000000-0000-0000-0000-000000000010"
export const TEST_TASK_ID = "00000000-0000-0000-0000-000000000020"
export const TEST_CALLBACK_TOKEN = "00000000-0000-0000-0000-000000000030"

// In-memory store for mock DB
export function createMockStore() {
	return {
		apiKeys: [
			{ id: "ak-1", key: TEST_API_KEY, userId: TEST_USER_ID },
		] as Array<{ id: string; key: string; userId: string }>,
		oauthTokens: [
			{ userId: TEST_USER_ID, accessToken: "gh_test_token" },
		] as Array<{ userId: string; accessToken: string }>,
		workspaces: [] as Array<Record<string, unknown>>,
		tasks: [] as Array<Record<string, unknown>>,
		taskMessages: [] as Array<Record<string, unknown>>,
	}
}

export type MockStore = ReturnType<typeof createMockStore>

// Mock DB module
export function mockDbModule(_store: MockStore) {
	// Chain builder that captures operations
	function createChainBuilder(operation: string) {
		const chain: Record<string, unknown> = {
			_op: operation,
			_table: null,
			_where: null,
			_set: null,
			_values: null,
			_orderBy: null,
			_limit: null,
		}

		const builder = {
			select: (cols?: Record<string, unknown>) => {
				chain._selectCols = cols
				return builder
			},
			from: (table: unknown) => {
				chain._table = table
				return builder
			},
			insert: (table: unknown) => {
				chain._table = table
				return builder
			},
			update: (table: unknown) => {
				chain._table = table
				return builder
			},
			delete: (table: unknown) => {
				chain._table = table
				return builder
			},
			values: (vals: unknown) => {
				chain._values = vals
				return builder
			},
			set: (vals: unknown) => {
				chain._set = vals
				return builder
			},
			where: () => builder,
			orderBy: () => builder,
			limit: () => builder,
			returning: () => builder,
			onConflictDoUpdate: () => builder,
			// biome-ignore lint/suspicious/noThenProperty: needed for Drizzle thenable mock
			then: (resolve: (val: unknown) => void) => {
				// Return empty results by default
				resolve([])
			},
		}

		return builder
	}

	return {
		select: () => createChainBuilder("select"),
		insert: () => createChainBuilder("insert"),
		update: () => createChainBuilder("update"),
		delete: () => createChainBuilder("delete"),
	}
}

// Helper for setting auth header
export function authHeaders(apiKey = TEST_API_KEY) {
	return {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	}
}

// Mock GitHub API responses
export function createGitHubMock() {
	const responses = new Map<string, { status: number; body: unknown }>()

	return {
		set(urlPattern: string, status: number, body: unknown) {
			responses.set(urlPattern, { status, body })
		},
		handler(url: string, _init?: RequestInit) {
			for (const [pattern, response] of responses) {
				if (url.includes(pattern)) {
					return new Response(JSON.stringify(response.body), {
						status: response.status,
						headers: { "Content-Type": "application/json" },
					})
				}
			}
			return new Response(JSON.stringify({ message: "Not Found" }), {
				status: 404,
			})
		},
	}
}
