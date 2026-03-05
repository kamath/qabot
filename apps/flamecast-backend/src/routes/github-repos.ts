import { Hono } from "hono"
import { z } from "zod"
import { describeRoute, resolver } from "hono-openapi"
const GitHubErrorSchema = z.object({ error: z.string() })
import { getGitHubAccessToken } from "../lib/auth"
import { getOctokit } from "../lib/octokit"
import { RequestError } from "@octokit/request-error"
import { authMiddleware, type AuthEnv } from "../lib/middleware"

const githubRepos = new Hono<AuthEnv>().use(authMiddleware).get(
	"/user",
	describeRoute({
		description: "Get the authenticated GitHub user's profile.",
		tags: ["github"],
		responses: {
			200: {
				description: "GitHub user profile",
				content: {
					"application/json": {
						schema: resolver(z.object({ login: z.string() })),
					},
				},
			},
			403: {
				description: "GitHub token not found",
				content: {
					"application/json": { schema: resolver(GitHubErrorSchema) },
				},
			},
		},
	}),
	async c => {
		const db = c.get("db")
		const authRow = c.get("authRow")

		const accessToken = await getGitHubAccessToken(db, authRow.userId)
		if (!accessToken) return c.json({ error: "GitHub token not found" }, 403)

		try {
			const octokit = getOctokit(accessToken)
			const { data: user } = await octokit.users.getAuthenticated()
			return c.json({ login: user.login })
		} catch (err) {
			if (err instanceof RequestError) {
				return c.json(
					{ error: `GitHub API error: ${err.status}` },
					err.status as 400,
				)
			}
			throw err
		}
	},
)

export default githubRepos
