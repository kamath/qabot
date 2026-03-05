import { Hono } from "hono"
import { validator as zValidator, describeRoute, resolver } from "hono-openapi"
import {
	AddSkillRequestSchema,
	AddSkillResponseSchema,
	ListSkillsResponseSchema,
	RemoveSkillResponseSchema,
	SkillErrorSchema,
} from "@flamecast/api-schemas"
import {
	fetchSkillFromRegistry,
	parseGitUrl,
	fetchSkillFiles,
	commitSkillFiles,
	removeSkillFiles,
	listInstalledSkills,
	deriveSlugFromGitUrl,
	deriveQualifiedNameFromGitUrl,
	validateSkillFiles,
	extractDescriptionFromFiles,
	type SkillMeta,
} from "../lib/skills"
import { getGitHubAccessToken } from "../lib/auth"
import { getOctokit } from "../lib/octokit"
import { workspaceMiddleware, type WorkspaceEnv } from "../lib/middleware"
import { trackEvent, AnalyticsEvents } from "../lib/analytics"

const skills = new Hono<WorkspaceEnv>()
	.use(workspaceMiddleware)
	.post(
		"/",
		describeRoute({
			description:
				"Add a skill to a workspace from the Smithery registry or a git URL.",
			tags: ["skills"],
			responses: {
				200: {
					description: "Skill added",
					content: {
						"application/json": {
							schema: resolver(AddSkillResponseSchema),
						},
					},
				},
				400: {
					description: "Invalid request",
					content: {
						"application/json": {
							schema: resolver(SkillErrorSchema),
						},
					},
				},
				404: {
					description: "Skill not found",
					content: {
						"application/json": {
							schema: resolver(SkillErrorSchema),
						},
					},
				},
				500: {
					description: "Internal error",
					content: {
						"application/json": {
							schema: resolver(SkillErrorSchema),
						},
					},
				},
			},
		}),
		zValidator("json", AddSkillRequestSchema),
		async c => {
			const db = c.get("db")
			const authRow = c.get("authRow")
			const ws = c.get("workspace")

			const { skill: input } = c.req.valid("json")

			const accessToken = await getGitHubAccessToken(db, authRow.userId)
			if (!accessToken) return c.json({ error: "GitHub token not found" }, 403)

			const octokit = getOctokit(accessToken)

			try {
				let slug: string
				let qualifiedName: string
				let description: string | undefined
				let gitUrl: string

				if (input.startsWith("https://")) {
					// Direct git URL
					gitUrl = input
					slug = deriveSlugFromGitUrl(gitUrl)
					qualifiedName = deriveQualifiedNameFromGitUrl(gitUrl)
				} else {
					// Registry lookup
					const skillInfo = await fetchSkillFromRegistry(input)
					slug = skillInfo.slug
					qualifiedName = skillInfo.qualifiedName
					description = skillInfo.description
					gitUrl = skillInfo.gitUrl
				}

				// Parse the git URL and fetch files from source repo
				const { owner, repo, branch, path } = parseGitUrl(gitUrl)
				const files = await fetchSkillFiles(owner, repo, branch, path, octokit)

				// Validate that this is a skill directory
				validateSkillFiles(files)

				// For git URL skills, try to extract description from SKILL.md
				if (!description) {
					description = extractDescriptionFromFiles(files)
				}

				// Build metadata
				const meta: SkillMeta = {
					qualifiedName,
					description,
					gitUrl,
					installedAt: new Date().toISOString(),
				}

				// Commit files to workspace repo
				await commitSkillFiles(ws.githubRepo, slug, files, octokit, meta)

				trackEvent(c.env, authRow.userId, AnalyticsEvents.SKILL_ADDED, {
					workspaceId: ws.id,
					skill: qualifiedName,
				})

				return c.json({
					skill: { qualifiedName, slug, description, gitUrl },
				})
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Failed to add skill"
				console.error("POST /skills error:", err)
				if (message.includes("Not a valid skill")) {
					return c.json({ error: message }, 400)
				}
				if (message.includes("not found")) {
					return c.json({ error: message }, 404)
				}
				return c.json({ error: message }, 500)
			}
		},
	)
	.get(
		"/",
		describeRoute({
			description: "List installed skills for a workspace.",
			tags: ["skills"],
			responses: {
				200: {
					description: "List of skills",
					content: {
						"application/json": {
							schema: resolver(ListSkillsResponseSchema),
						},
					},
				},
				500: {
					description: "Internal error",
					content: {
						"application/json": {
							schema: resolver(SkillErrorSchema),
						},
					},
				},
			},
		}),
		async c => {
			const db = c.get("db")
			const authRow = c.get("authRow")
			const ws = c.get("workspace")

			const accessToken = await getGitHubAccessToken(db, authRow.userId)
			if (!accessToken) return c.json({ error: "GitHub token not found" }, 403)

			const octokit = getOctokit(accessToken)

			try {
				const installed = await listInstalledSkills(ws.githubRepo, octokit)
				return c.json({ skills: installed })
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Failed to list skills"
				console.error("GET /skills error:", err)
				return c.json({ error: message }, 500)
			}
		},
	)
	.delete(
		"/:skill",
		describeRoute({
			description: "Remove an installed skill from a workspace.",
			tags: ["skills"],
			responses: {
				200: {
					description: "Skill removed",
					content: {
						"application/json": {
							schema: resolver(RemoveSkillResponseSchema),
						},
					},
				},
				404: {
					description: "Skill not found",
					content: {
						"application/json": {
							schema: resolver(SkillErrorSchema),
						},
					},
				},
				500: {
					description: "Internal error",
					content: {
						"application/json": {
							schema: resolver(SkillErrorSchema),
						},
					},
				},
			},
		}),
		async c => {
			const db = c.get("db")
			const authRow = c.get("authRow")
			const ws = c.get("workspace")
			const slug = c.req.param("skill")!

			const accessToken = await getGitHubAccessToken(db, authRow.userId)
			if (!accessToken) return c.json({ error: "GitHub token not found" }, 403)

			const octokit = getOctokit(accessToken)

			try {
				await removeSkillFiles(ws.githubRepo, slug, octokit)

				trackEvent(c.env, authRow.userId, AnalyticsEvents.SKILL_REMOVED, {
					workspaceId: ws.id,
					skill: slug,
				})

				return c.json({ success: true })
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Failed to remove skill"
				console.error("DELETE /skills error:", err)
				if (message.includes("not found")) {
					return c.json({ error: message }, 404)
				}
				return c.json({ error: message }, 500)
			}
		},
	)

export default skills
