import { Hono } from "hono"
import { z } from "zod"
import { describeRoute, resolver } from "hono-openapi"
import { getGitHubAccessToken } from "../lib/auth"
import { getOctokit } from "../lib/octokit"
import { authMiddleware, type AuthEnv } from "../lib/middleware"

const SetupStatusResponseSchema = z.object({
	username: z.string(),
	githubAppInstalled: z.boolean(),
	repoExists: z.boolean(),
	hasClaudeToken: z.boolean(),
	hasFlamecastPat: z.boolean(),
	hasFlamecastApiKey: z.boolean(),
})

const setup = new Hono<AuthEnv>().use(authMiddleware).get(
	"/status",
	describeRoute({
		description:
			"Check the setup status of the authenticated user's GitHub integration.",
		tags: ["setup"],
		responses: {
			200: {
				description: "Setup status",
				content: {
					"application/json": {
						schema: resolver(SetupStatusResponseSchema),
					},
				},
			},
			403: {
				description: "GitHub token not found",
				content: {
					"application/json": {
						schema: resolver(z.object({ error: z.string() })),
					},
				},
			},
		},
	}),
	async c => {
		const db = c.get("db")
		const authRow = c.get("authRow")

		const accessToken = await getGitHubAccessToken(db, authRow.userId)
		if (!accessToken) return c.json({ error: "GitHub token not found" }, 403)

		const octokit = getOctokit(accessToken)

		// Get authenticated user
		let username: string
		try {
			const { data: ghUser } = await octokit.users.getAuthenticated()
			username = ghUser.login
		} catch {
			return c.json({ error: "Failed to get GitHub user" }, 500)
		}

		// Check GitHub App installation and repo in parallel
		const [installationsResult, repoResult] = await Promise.allSettled([
			octokit.apps.listInstallationsForAuthenticatedUser(),
			octokit.repos.get({ owner: username, repo: "flamecast" }),
		])

		let githubAppInstalled = false
		if (installationsResult.status === "fulfilled") {
			githubAppInstalled = installationsResult.value.data.installations.some(
				(i: { app_slug?: string }) => i.app_slug === "flamecast-ai",
			)
		}

		const repoExists = repoResult.status === "fulfilled"

		let hasClaudeToken = false
		let hasFlamecastPat = false
		let hasFlamecastApiKey = false
		let hasSmitheryApiKey = false

		if (repoExists) {
			const secretChecks = await Promise.allSettled([
				octokit.actions.getRepoSecret({
					owner: username,
					repo: "flamecast",
					secret_name: "CLAUDE_CODE_OAUTH_TOKEN",
				}),
				octokit.actions.getRepoSecret({
					owner: username,
					repo: "flamecast",
					secret_name: "FLAMECAST_PAT",
				}),
				octokit.actions.getRepoSecret({
					owner: username,
					repo: "flamecast",
					secret_name: "FLAMECAST_API_KEY",
				}),
				octokit.actions.getRepoSecret({
					owner: username,
					repo: "flamecast",
					secret_name: "SMITHERY_API_KEY",
				}),
			])

			hasClaudeToken = secretChecks[0].status === "fulfilled"
			hasFlamecastPat = secretChecks[1].status === "fulfilled"
			hasFlamecastApiKey = secretChecks[2].status === "fulfilled"
			hasSmitheryApiKey = secretChecks[3].status === "fulfilled"
		}

		return c.json({
			username,
			githubAppInstalled,
			repoExists,
			hasClaudeToken,
			hasFlamecastPat,
			hasFlamecastApiKey,
			hasSmitheryApiKey,
		})
	},
)

export default setup
