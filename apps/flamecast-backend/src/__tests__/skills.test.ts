import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"
import type { Bindings } from "../index"

const TEST_USER_ID = "user_123"
const TEST_API_KEY_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
const TEST_WORKSPACE_ID = "11111111-2222-3333-4444-555555555555"

// ── Skills mocks ─────────────────────────────────────────────────

const mockFetchSkillFromRegistry = vi.fn()
const mockParseGitUrl = vi.fn()
const mockFetchSkillFiles = vi.fn()
const mockCommitSkillFiles = vi.fn()
const mockRemoveSkillFiles = vi.fn()
const mockListInstalledSkills = vi.fn()
const mockDeriveSlugFromGitUrl = vi.fn()
const mockDeriveQualifiedNameFromGitUrl = vi.fn()
const mockValidateSkillFiles = vi.fn()
const mockExtractDescriptionFromFiles = vi.fn()

vi.mock("../lib/skills", () => ({
	fetchSkillFromRegistry: (...args: unknown[]) =>
		mockFetchSkillFromRegistry(...args),
	parseGitUrl: (...args: unknown[]) => mockParseGitUrl(...args),
	fetchSkillFiles: (...args: unknown[]) => mockFetchSkillFiles(...args),
	commitSkillFiles: (...args: unknown[]) => mockCommitSkillFiles(...args),
	removeSkillFiles: (...args: unknown[]) => mockRemoveSkillFiles(...args),
	listInstalledSkills: (...args: unknown[]) => mockListInstalledSkills(...args),
	deriveSlugFromGitUrl: (...args: unknown[]) =>
		mockDeriveSlugFromGitUrl(...args),
	deriveQualifiedNameFromGitUrl: (...args: unknown[]) =>
		mockDeriveQualifiedNameFromGitUrl(...args),
	validateSkillFiles: (...args: unknown[]) => mockValidateSkillFiles(...args),
	extractDescriptionFromFiles: (...args: unknown[]) =>
		mockExtractDescriptionFromFiles(...args),
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

vi.mock("../lib/dispatch", () => ({
	dispatchWorkflow: vi.fn(async () => ({
		dispatched: true,
		workflowRunId: 12345,
	})),
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

const skillsPath = `/workspaces/${TEST_WORKSPACE_ID}/skills`

const defaultWorkspace = {
	id: TEST_WORKSPACE_ID,
	userId: TEST_USER_ID,
	name: "test-ws",
	githubRepo: "testuser/test-ws",
	status: "ready",
	config: { tools: [] },
	createdAt: new Date(),
	updatedAt: new Date(),
}

// ── Tests ───────────────────────────────────────────────────────

describe("POST /skills — add skill from registry", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		currentWorkspace = null
	})

	it("adds a skill via qualified name (registry path)", async () => {
		currentWorkspace = { ...defaultWorkspace }

		mockFetchSkillFromRegistry.mockResolvedValue({
			qualifiedName: "a5c-ai/architecture-analyzer",
			slug: "architecture-analyzer",
			description: "Analyze architecture",
			gitUrl: "https://github.com/a5c-ai/architecture-analyzer/tree/main/skill",
		})
		mockParseGitUrl.mockReturnValue({
			owner: "a5c-ai",
			repo: "architecture-analyzer",
			branch: "main",
			path: "skill",
		})
		mockFetchSkillFiles.mockResolvedValue([
			{ path: "SKILL.md", content: "c2tpbGw=" },
		])
		mockCommitSkillFiles.mockResolvedValue(undefined)

		const app = createApp()
		const res = await app.request(skillsPath, {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ skill: "a5c-ai/architecture-analyzer" }),
		})

		expect(res.status).toBe(200)
		const body: any = await res.json()
		expect(body.skill.qualifiedName).toBe("a5c-ai/architecture-analyzer")
		expect(body.skill.slug).toBe("architecture-analyzer")
		expect(body.skill.description).toBe("Analyze architecture")

		// Verify commitSkillFiles was called with meta
		expect(mockCommitSkillFiles).toHaveBeenCalledWith(
			"testuser/test-ws",
			"architecture-analyzer",
			[{ path: "SKILL.md", content: "c2tpbGw=" }],
			expect.any(Object),
			expect.objectContaining({
				qualifiedName: "a5c-ai/architecture-analyzer",
				gitUrl:
					"https://github.com/a5c-ai/architecture-analyzer/tree/main/skill",
				installedAt: expect.any(String),
			}),
		)
	})

	it("adds a skill via git URL (direct path)", async () => {
		currentWorkspace = { ...defaultWorkspace }

		mockDeriveSlugFromGitUrl.mockReturnValue("prompt_evaluations")
		mockDeriveQualifiedNameFromGitUrl.mockReturnValue(
			"anthropics/prompt_evaluations",
		)
		mockParseGitUrl.mockReturnValue({
			owner: "anthropics",
			repo: "courses",
			branch: "master",
			path: "prompt_evaluations",
		})
		mockFetchSkillFiles.mockResolvedValue([
			{ path: "SKILL.md", content: "c2tpbGw=" },
		])
		mockExtractDescriptionFromFiles.mockReturnValue(
			"Learn prompt evaluation techniques",
		)
		mockCommitSkillFiles.mockResolvedValue(undefined)

		const app = createApp()
		const res = await app.request(skillsPath, {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({
				skill:
					"https://github.com/anthropics/courses/tree/master/prompt_evaluations",
			}),
		})

		expect(res.status).toBe(200)
		const body: any = await res.json()
		expect(body.skill.slug).toBe("prompt_evaluations")
		expect(body.skill.qualifiedName).toBe("anthropics/prompt_evaluations")
		expect(body.skill.description).toBe("Learn prompt evaluation techniques")
		expect(body.skill.gitUrl).toBe(
			"https://github.com/anthropics/courses/tree/master/prompt_evaluations",
		)

		// Should NOT have called the registry
		expect(mockFetchSkillFromRegistry).not.toHaveBeenCalled()

		// Should have called deriveSlugFromGitUrl and deriveQualifiedNameFromGitUrl
		expect(mockDeriveSlugFromGitUrl).toHaveBeenCalledWith(
			"https://github.com/anthropics/courses/tree/master/prompt_evaluations",
		)
		expect(mockDeriveQualifiedNameFromGitUrl).toHaveBeenCalledWith(
			"https://github.com/anthropics/courses/tree/master/prompt_evaluations",
		)

		// Verify meta includes description
		expect(mockCommitSkillFiles).toHaveBeenCalledWith(
			"testuser/test-ws",
			"prompt_evaluations",
			expect.any(Array),
			expect.any(Object),
			expect.objectContaining({
				qualifiedName: "anthropics/prompt_evaluations",
				description: "Learn prompt evaluation techniques",
				gitUrl:
					"https://github.com/anthropics/courses/tree/master/prompt_evaluations",
				installedAt: expect.any(String),
			}),
		)
	})

	it("returns 400 when directory has no SKILL.md", async () => {
		currentWorkspace = { ...defaultWorkspace }

		mockDeriveSlugFromGitUrl.mockReturnValue("some-dir")
		mockDeriveQualifiedNameFromGitUrl.mockReturnValue("owner/some-dir")
		mockParseGitUrl.mockReturnValue({
			owner: "owner",
			repo: "repo",
			branch: "main",
			path: "some-dir",
		})
		mockFetchSkillFiles.mockResolvedValue([
			{ path: "README.md", content: "cmVhZG1l" },
		])
		mockValidateSkillFiles.mockImplementation(() => {
			throw new Error(
				"Not a valid skill: directory must contain a SKILL.md file at its root",
			)
		})

		const app = createApp()
		const res = await app.request(skillsPath, {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({
				skill: "https://github.com/owner/repo/tree/main/some-dir",
			}),
		})

		expect(res.status).toBe(400)
		const body: any = await res.json()
		expect(body.error).toContain("SKILL.md")
	})

	it("returns 404 when registry lookup fails", async () => {
		currentWorkspace = { ...defaultWorkspace }

		mockFetchSkillFromRegistry.mockRejectedValue(
			new Error('Skill "bad/skill" not found in registry (404)'),
		)

		const app = createApp()
		const res = await app.request(skillsPath, {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ skill: "bad/skill" }),
		})

		expect(res.status).toBe(404)
		const body: any = await res.json()
		expect(body.error).toContain("not found in registry")
	})
})

describe("GET /skills — list installed skills", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		currentWorkspace = null
	})

	it("returns installed skills with qualified names and descriptions from index", async () => {
		currentWorkspace = { ...defaultWorkspace }

		mockListInstalledSkills.mockResolvedValue([
			{
				qualifiedName: "a5c-ai/architecture-analyzer",
				slug: "architecture-analyzer",
				description: "Analyze architecture",
			},
			{
				qualifiedName: "anthropics/prompt_evaluations",
				slug: "prompt_evaluations",
				description: "Learn prompt evaluation techniques",
			},
		])

		const app = createApp()
		const res = await app.request(skillsPath, {
			method: "GET",
			headers: authHeaders,
		})

		expect(res.status).toBe(200)
		const body: any = await res.json()
		expect(body.skills).toHaveLength(2)
		expect(body.skills[0].qualifiedName).toBe("a5c-ai/architecture-analyzer")
		expect(body.skills[0].slug).toBe("architecture-analyzer")
		expect(body.skills[0].description).toBe("Analyze architecture")
		expect(body.skills[1].description).toBe(
			"Learn prompt evaluation techniques",
		)
	})

	it("returns empty array when no skills installed", async () => {
		currentWorkspace = { ...defaultWorkspace }

		mockListInstalledSkills.mockResolvedValue([])

		const app = createApp()
		const res = await app.request(skillsPath, {
			method: "GET",
			headers: authHeaders,
		})

		expect(res.status).toBe(200)
		const body: any = await res.json()
		expect(body.skills).toEqual([])
	})
})

describe("DELETE /skills/:skill — remove skill", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		currentWorkspace = null
	})

	it("removes a skill by slug", async () => {
		currentWorkspace = { ...defaultWorkspace }

		mockRemoveSkillFiles.mockResolvedValue(undefined)

		const app = createApp()
		const res = await app.request(`${skillsPath}/architecture-analyzer`, {
			method: "DELETE",
			headers: authHeaders,
		})

		expect(res.status).toBe(200)
		const body: any = await res.json()
		expect(body.success).toBe(true)

		expect(mockRemoveSkillFiles).toHaveBeenCalledWith(
			"testuser/test-ws",
			"architecture-analyzer",
			expect.any(Object),
		)
	})

	it("returns 404 when skill not found", async () => {
		currentWorkspace = { ...defaultWorkspace }

		mockRemoveSkillFiles.mockRejectedValue(
			new Error('Skill "nonexistent" not found in repository'),
		)

		const app = createApp()
		const res = await app.request(`${skillsPath}/nonexistent`, {
			method: "DELETE",
			headers: authHeaders,
		})

		expect(res.status).toBe(404)
		const body: any = await res.json()
		expect(body.error).toContain("not found")
	})

	it("returns 500 on unexpected error", async () => {
		currentWorkspace = { ...defaultWorkspace }

		mockRemoveSkillFiles.mockRejectedValue(new Error("Failed to get repo info"))

		const app = createApp()
		const res = await app.request(`${skillsPath}/some-skill`, {
			method: "DELETE",
			headers: authHeaders,
		})

		expect(res.status).toBe(500)
		const body: any = await res.json()
		expect(body.error).toBe("Failed to get repo info")
	})
})
