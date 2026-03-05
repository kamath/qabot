import { Hono } from "hono"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { validator as zValidator, describeRoute, resolver } from "hono-openapi"
import {
	workspaces as workspacesTable,
	userOrganizations as userOrganizationsTable,
} from "@flamecast/db/schema"
import { getScaffoldFilesBase64 } from "../scaffold"
import {
	CreateWorkspaceRequestSchema,
	SetWorkspaceSecretsRequestSchema,
	SetDefaultWorkspaceRequestSchema,
	DefaultWorkspaceResponseSchema,
	ListWorkspacesResponseSchema,
	SyncWorkflowsResponseSchema,
	WorkspaceItemSchema,
	WorkspaceErrorSchema,
} from "@flamecast/api-schemas"
import { getGitHubAccessToken } from "../lib/auth"
import { getOctokit, type OctokitClient } from "../lib/octokit"
import { RequestError } from "@octokit/request-error"
import {
	getHeadContext,
	createBlobs,
	createTree,
	createCommit,
	updateBranchRef,
} from "../lib/github"
import { encryptSecret } from "../lib/github-secrets"
import { trackEvent, AnalyticsEvents } from "../lib/analytics"
import { createSmitheryClient, createConnectionToken } from "../lib/smithery"
import {
	authMiddleware,
	workspaceMiddleware,
	type AuthEnv,
} from "../lib/middleware"
import tasks from "./tasks"
import mcp from "./mcp"
import skills from "./skills"

function serializeWorkspace(
	ws: typeof workspacesTable.$inferSelect,
	secretNames?: string[],
) {
	return {
		id: ws.id,
		name: ws.name,
		githubRepo: ws.githubRepo,
		status: ws.status,
		config: ws.config,
		secretNames,
		createdAt: ws.createdAt.toISOString(),
		updatedAt: ws.updatedAt.toISOString(),
	}
}

async function getSecretNames(
	githubRepo: string,
	octokit: OctokitClient,
): Promise<string[]> {
	try {
		const [owner, repo] = githubRepo.split("/")
		const { data } = await octokit.actions.listRepoSecrets({
			owner: owner!,
			repo: repo!,
		})
		return data.secrets.map(s => s.name)
	} catch {
		return []
	}
}

const workspaces = new Hono<AuthEnv>()
	.use(authMiddleware)
	.get(
		"/default",
		describeRoute({
			description: "Get the authenticated user's default workspace ID.",
			tags: ["workspaces"],
			responses: {
				200: {
					description: "Default workspace ID (null if not set)",
					content: {
						"application/json": {
							schema: resolver(DefaultWorkspaceResponseSchema),
						},
					},
				},
			},
		}),
		async c => {
			const db = c.get("db")
			const authRow = c.get("authRow")

			const [userOrg] = await db
				.select({
					defaultWorkspaceId: userOrganizationsTable.defaultWorkspaceId,
				})
				.from(userOrganizationsTable)
				.where(eq(userOrganizationsTable.userId, authRow.userId))
				.limit(1)

			return c.json({
				defaultWorkspaceId: userOrg?.defaultWorkspaceId ?? null,
			})
		},
	)
	.put(
		"/default",
		describeRoute({
			description: "Set the authenticated user's default workspace.",
			tags: ["workspaces"],
			responses: {
				200: {
					description: "Default workspace updated",
					content: {
						"application/json": {
							schema: resolver(DefaultWorkspaceResponseSchema),
						},
					},
				},
				404: {
					description: "Workspace not found",
					content: {
						"application/json": {
							schema: resolver(WorkspaceErrorSchema),
						},
					},
				},
			},
		}),
		zValidator("json", SetDefaultWorkspaceRequestSchema),
		async c => {
			const db = c.get("db")
			const authRow = c.get("authRow")
			const { workspaceId } = c.req.valid("json")

			// Verify the workspace belongs to this user
			const [ws] = await db
				.select()
				.from(workspacesTable)
				.where(eq(workspacesTable.id, workspaceId))
				.limit(1)

			if (!ws || ws.userId !== authRow.userId) {
				return c.json({ error: "Workspace not found" }, 404)
			}

			await db
				.update(userOrganizationsTable)
				.set({ defaultWorkspaceId: workspaceId })
				.where(eq(userOrganizationsTable.userId, authRow.userId))

			trackEvent(c.env, authRow.userId, AnalyticsEvents.WORKSPACE_DEFAULT_SET, {
				workspaceId,
			})

			return c.json({ defaultWorkspaceId: workspaceId })
		},
	)
	.post(
		"/",
		describeRoute({
			description:
				"Create a new workspace, including GitHub repo provisioning, workflow setup, and secrets configuration.",
			tags: ["workspaces"],
			responses: {
				200: {
					description: "Workspace created successfully",
					content: {
						"application/json": {
							schema: resolver(WorkspaceItemSchema),
						},
					},
				},
				409: {
					description: "Workspace already exists",
					content: {
						"application/json": {
							schema: resolver(WorkspaceErrorSchema),
						},
					},
				},
				500: {
					description: "Internal error",
					content: {
						"application/json": {
							schema: resolver(WorkspaceErrorSchema),
						},
					},
				},
			},
		}),
		zValidator("json", CreateWorkspaceRequestSchema),
		async c => {
			const db = c.get("db")
			const authRow = c.get("authRow")

			const { name, systemPrompt, secrets, tools } = c.req.valid("json")

			const accessToken = await getGitHubAccessToken(db, authRow.userId)
			if (!accessToken) return c.json({ error: "GitHub token not found" }, 403)

			const octokit = getOctokit(accessToken)

			// Get GitHub username
			let username: string
			try {
				const { data: ghUser } = await octokit.users.getAuthenticated()
				username = ghUser.login
			} catch {
				return c.json({ error: "Failed to get GitHub user" }, 500)
			}

			const repoName = `flamecast-${name}`
			const fullRepo = `${username}/${repoName}`

			// Check if repo already exists
			try {
				await octokit.repos.get({ owner: username, repo: repoName })
				return c.json({ error: "Workspace already exists" }, 409)
			} catch (err) {
				if (!(err instanceof RequestError && err.status === 404)) {
					return c.json({ error: "Failed to check repo existence" }, 500)
				}
				// 404 means repo doesn't exist, which is what we want
			}

			// Insert workspace record
			const [workspace] = await db
				.insert(workspacesTable)
				.values({
					userId: authRow.userId,
					name,
					githubRepo: fullRepo,
					status: "provisioning",
					config: { systemPrompt, tools: tools || [] },
				})
				.returning()

			// Create the repo
			try {
				await octokit.repos.createForAuthenticatedUser({
					name: repoName,
					description: `Flamecast workspace: ${name}`,
					private: true,
					auto_init: true,
				})
			} catch (err) {
				await db
					.update(workspacesTable)
					.set({ status: "error" })
					.where(eq(workspacesTable.id, workspace.id))
				const message =
					err instanceof RequestError ? err.message : "Unknown error"
				return c.json({ error: `Failed to create repo: ${message}` }, 500)
			}

			// Commit scaffold files (retry first file — repo may not be ready immediately)
			const scaffoldFiles = getScaffoldFilesBase64(systemPrompt)
			for (let i = 0; i < scaffoldFiles.length; i++) {
				const file = scaffoldFiles[i]
				let committed = false
				let lastError = ""
				const maxAttempts = i === 0 ? 3 : 1
				for (let attempt = 0; attempt < maxAttempts; attempt++) {
					if (i === 0) await new Promise(resolve => setTimeout(resolve, 1000))
					try {
						await octokit.repos.createOrUpdateFileContents({
							owner: username,
							repo: repoName,
							path: file.path,
							message: `Add ${file.path}`,
							content: file.content,
						})
						committed = true
						break
					} catch (err) {
						lastError =
							err instanceof RequestError
								? `${err.status}: ${err.message}`
								: "Unknown error"
						console.error(
							`Failed to commit ${file.path} (attempt ${attempt + 1}): ${lastError}`,
						)
					}
				}
				if (!committed) {
					await db
						.update(workspacesTable)
						.set({ status: "error" })
						.where(eq(workspacesTable.id, workspace.id))
					return c.json(
						{
							error: `Failed to commit ${file.path}: ${lastError}`,
						},
						500,
					)
				}
			}

			// Fetch repo public key for encrypting secrets
			try {
				const { data: publicKey } = await octokit.actions.getRepoPublicKey({
					owner: username,
					repo: repoName,
				})

				// Store user-provided secrets
				if (secrets && Object.keys(secrets).length > 0) {
					for (const [secretName, secretValue] of Object.entries(secrets)) {
						if (!secretValue) continue
						const encryptedBase64 = encryptSecret(secretValue, publicKey.key)
						await octokit.actions.createOrUpdateRepoSecret({
							owner: username,
							repo: repoName,
							secret_name: secretName,
							encrypted_value: encryptedBase64,
							key_id: publicKey.key_id,
						})
					}
				}

				// Push SMITHERY_API_KEY — Smithery connection token for MCP/CLI
				try {
					const smitheryClient = createSmitheryClient(c.env.SMITHERY_API_KEY)
					const smitheryToken = await createConnectionToken(
						smitheryClient,
						workspace.id,
					)
					const encryptedSmitheryKey = encryptSecret(
						smitheryToken,
						publicKey.key,
					)
					await octokit.actions.createOrUpdateRepoSecret({
						owner: username,
						repo: repoName,
						secret_name: "SMITHERY_API_KEY",
						encrypted_value: encryptedSmitheryKey,
						key_id: publicKey.key_id,
					})
				} catch (err) {
					console.error("Failed to push SMITHERY_API_KEY:", err)
					// Non-fatal — workspace is still usable
				}

				// Push FLAMECAST_API_KEY — WorkOS org API key for Flamecast API auth
				try {
					const workos = c.get("workos")
					const authRow = c.get("authRow")
					const [orgRow] = await db
						.select({
							organizationId: userOrganizationsTable.organizationId,
						})
						.from(userOrganizationsTable)
						.where(eq(userOrganizationsTable.userId, authRow.userId))
						.limit(1)

					if (orgRow) {
						const apiKey = await workos.organizations.createOrganizationApiKey({
							organizationId: orgRow.organizationId,
							name: workspace.name || "Workspace API Key",
						})
						const encryptedApiKey = encryptSecret(apiKey.value, publicKey.key)
						await octokit.actions.createOrUpdateRepoSecret({
							owner: username,
							repo: repoName,
							secret_name: "FLAMECAST_API_KEY",
							encrypted_value: encryptedApiKey,
							key_id: publicKey.key_id,
						})
					}
				} catch (err) {
					console.error("Failed to push FLAMECAST_API_KEY:", err)
					// Non-fatal — workspace is still usable
				}

				// Push FLAMECAST_API_URL
				try {
					const flamecastApiUrl = "https://api.flamecast.dev"
					const encryptedApiUrl = encryptSecret(flamecastApiUrl, publicKey.key)
					await octokit.actions.createOrUpdateRepoSecret({
						owner: username,
						repo: repoName,
						secret_name: "FLAMECAST_API_URL",
						encrypted_value: encryptedApiUrl,
						key_id: publicKey.key_id,
					})
				} catch (err) {
					console.error("Failed to push FLAMECAST_API_URL:", err)
					// Non-fatal — workspace is still usable
				}
			} catch {
				// Non-fatal — secrets setup failed but workspace may still be usable
			}

			// Update workspace status to ready
			const [updated] = await db
				.update(workspacesTable)
				.set({ status: "ready" })
				.where(eq(workspacesTable.id, workspace.id))
				.returning()

			// Auto-set as default if user has no default yet
			const [userOrg] = await db
				.select({
					defaultWorkspaceId: userOrganizationsTable.defaultWorkspaceId,
				})
				.from(userOrganizationsTable)
				.where(eq(userOrganizationsTable.userId, authRow.userId))
				.limit(1)

			if (userOrg && !userOrg.defaultWorkspaceId) {
				await db
					.update(userOrganizationsTable)
					.set({ defaultWorkspaceId: updated.id })
					.where(eq(userOrganizationsTable.userId, authRow.userId))
			}

			trackEvent(c.env, authRow.userId, AnalyticsEvents.WORKSPACE_CREATED, {
				workspace: fullRepo,
				name,
			})

			return c.json(serializeWorkspace(updated))
		},
	)
	.get(
		"/",
		describeRoute({
			description: "List all workspaces owned by the authenticated user.",
			tags: ["workspaces"],
			responses: {
				200: {
					description: "List of workspaces",
					content: {
						"application/json": {
							schema: resolver(ListWorkspacesResponseSchema),
						},
					},
				},
				500: {
					description: "Internal error",
					content: {
						"application/json": {
							schema: resolver(WorkspaceErrorSchema),
						},
					},
				},
			},
		}),
		async c => {
			try {
				const db = c.get("db")
				const authRow = c.get("authRow")

				const rows = await db
					.select()
					.from(workspacesTable)
					.where(eq(workspacesTable.userId, authRow.userId))

				const accessToken = await getGitHubAccessToken(db, authRow.userId)
				const octokit = accessToken ? getOctokit(accessToken) : null
				const workspacesWithSecrets = await Promise.all(
					rows.map(async ws => {
						const secretNames = octokit
							? await getSecretNames(ws.githubRepo, octokit)
							: undefined
						return serializeWorkspace(ws, secretNames)
					}),
				)

				return c.json({
					workspaces: workspacesWithSecrets,
				})
			} catch (err) {
				console.error("GET /workspaces error:", err)
				return c.json(
					{
						error: err instanceof Error ? err.message : "Internal error",
					},
					500,
				)
			}
		},
	)
	.get(
		"/:workspaceId",
		describeRoute({
			description: "Get a workspace by ID.",
			tags: ["workspaces"],
			responses: {
				200: {
					description: "Workspace details",
					content: {
						"application/json": {
							schema: resolver(WorkspaceItemSchema),
						},
					},
				},
				404: {
					description: "Workspace not found",
					content: {
						"application/json": {
							schema: resolver(WorkspaceErrorSchema),
						},
					},
				},
			},
		}),
		workspaceMiddleware,
		async c => {
			const db = c.get("db")
			const authRow = c.get("authRow")
			const ws = c.get("workspace")
			const accessToken = await getGitHubAccessToken(db, authRow.userId)
			const octokit = accessToken ? getOctokit(accessToken) : null
			const secretNames = octokit
				? await getSecretNames(ws.githubRepo, octokit)
				: undefined
			return c.json(serializeWorkspace(ws, secretNames))
		},
	)
	.delete(
		"/:workspaceId",
		describeRoute({
			description: "Delete a workspace and its associated GitHub repository.",
			tags: ["workspaces"],
			responses: {
				200: {
					description: "Workspace deleted",
					content: {
						"application/json": {
							schema: resolver(
								z.object({
									success: z.boolean(),
									repoDeleted: z.boolean(),
								}),
							),
						},
					},
				},
				404: {
					description: "Workspace not found",
					content: {
						"application/json": {
							schema: resolver(WorkspaceErrorSchema),
						},
					},
				},
			},
		}),
		workspaceMiddleware,
		async c => {
			const db = c.get("db")
			const authRow = c.get("authRow")
			const ws = c.get("workspace")

			await db.delete(workspacesTable).where(eq(workspacesTable.id, ws.id))

			let repoDeleted = false
			try {
				const accessToken = await getGitHubAccessToken(db, authRow.userId)
				if (accessToken) {
					const octokit = getOctokit(accessToken)
					const [owner, repo] = ws.githubRepo.split("/")
					await octokit.repos.delete({ owner: owner!, repo: repo! })
					repoDeleted = true
				}
			} catch {
				repoDeleted = false
			}

			trackEvent(c.env, authRow.userId, AnalyticsEvents.WORKSPACE_DELETED, {
				workspaceId: ws.id,
				name: ws.name,
				repoDeleted,
			})

			return c.json({ success: true, repoDeleted })
		},
	)
	.put(
		"/:workspaceId/secrets",
		describeRoute({
			description:
				"Encrypt and push secrets to the workspace's GitHub Actions repository.",
			tags: ["workspaces"],
			responses: {
				200: {
					description: "Secrets stored successfully",
					content: {
						"application/json": {
							schema: resolver(z.object({ success: z.boolean() })),
						},
					},
				},
				403: {
					description: "GitHub token not found",
					content: {
						"application/json": {
							schema: resolver(WorkspaceErrorSchema),
						},
					},
				},
				404: {
					description: "Workspace not found",
					content: {
						"application/json": {
							schema: resolver(WorkspaceErrorSchema),
						},
					},
				},
				500: {
					description: "Failed to push secrets",
					content: {
						"application/json": {
							schema: resolver(WorkspaceErrorSchema),
						},
					},
				},
			},
		}),
		workspaceMiddleware,
		zValidator("json", SetWorkspaceSecretsRequestSchema),
		async c => {
			const db = c.get("db")
			const authRow = c.get("authRow")
			const ws = c.get("workspace")

			const { secrets } = c.req.valid("json")

			const accessToken = await getGitHubAccessToken(db, authRow.userId)
			if (!accessToken) return c.json({ error: "GitHub token not found" }, 403)

			const octokit = getOctokit(accessToken)
			const [owner, repo] = ws.githubRepo.split("/")

			let publicKey: { key: string; key_id: string }
			try {
				const { data } = await octokit.actions.getRepoPublicKey({
					owner: owner!,
					repo: repo!,
				})
				publicKey = data
			} catch {
				return c.json({ error: "Failed to get repo public key" }, 500)
			}

			for (const [secretName, secretValue] of Object.entries(secrets)) {
				if (!secretValue) continue
				const encryptedBase64 = encryptSecret(secretValue, publicKey.key)
				await octokit.actions.createOrUpdateRepoSecret({
					owner: owner!,
					repo: repo!,
					secret_name: secretName,
					encrypted_value: encryptedBase64,
					key_id: publicKey.key_id,
				})
			}

			trackEvent(
				c.env,
				authRow.userId,
				AnalyticsEvents.WORKSPACE_SECRETS_UPDATED,
				{ workspaceId: ws.id, secretCount: Object.keys(secrets).length },
			)

			return c.json({ success: true })
		},
	)
	.post(
		"/:workspaceId/sync-workflows",
		describeRoute({
			description:
				"Sync the latest workflow files to the workspace's GitHub repository by pushing directly to the default branch.",
			tags: ["workspaces"],
			responses: {
				200: {
					description: "Workflow files synced to default branch",
					content: {
						"application/json": {
							schema: resolver(SyncWorkflowsResponseSchema),
						},
					},
				},
				403: {
					description: "GitHub token not found",
					content: {
						"application/json": {
							schema: resolver(WorkspaceErrorSchema),
						},
					},
				},
				404: {
					description: "Workspace not found",
					content: {
						"application/json": {
							schema: resolver(WorkspaceErrorSchema),
						},
					},
				},
				500: {
					description: "Failed to sync workflow files",
					content: {
						"application/json": {
							schema: resolver(WorkspaceErrorSchema),
						},
					},
				},
			},
		}),
		workspaceMiddleware,
		async c => {
			const db = c.get("db")
			const authRow = c.get("authRow")
			const ws = c.get("workspace")

			const accessToken = await getGitHubAccessToken(db, authRow.userId)
			if (!accessToken) return c.json({ error: "GitHub token not found" }, 403)

			const octokit = getOctokit(accessToken)
			const repo = ws.githubRepo

			const { defaultBranch, baseSha, baseTreeSha } = await getHeadContext(
				repo,
				octokit,
			)

			const config = ws.config
			const filesToSync = getScaffoldFilesBase64(config.systemPrompt)

			const treeItems = await createBlobs(repo, octokit, filesToSync)
			if (treeItems.length === 0) {
				return c.json({ error: "Failed to create any file blobs" }, 500)
			}

			const treeSha = await createTree(repo, octokit, treeItems, baseTreeSha)
			const commitSha = await createCommit(
				repo,
				octokit,
				"Sync flamecast workspace files",
				treeSha,
				baseSha,
			)

			await updateBranchRef(repo, octokit, defaultBranch, commitSha)

			trackEvent(
				c.env,
				authRow.userId,
				AnalyticsEvents.WORKSPACE_WORKFLOWS_SYNCED,
				{ workspaceId: ws.id },
			)

			return c.json({
				success: true,
				updated: treeItems.map(t => t.path),
			})
		},
	)
	.post(
		"/:workspaceId/secrets/refresh",
		describeRoute({
			description:
				"Rotate the SMITHERY_API_KEY and FLAMECAST_API_KEY secrets for a workspace's GitHub repository.",
			tags: ["workspaces"],
			responses: {
				200: {
					description: "Token refresh results",
					content: {
						"application/json": {
							schema: resolver(
								z.object({
									smitheryApiKey: z.boolean(),
									flamecastApiKey: z.boolean(),
								}),
							),
						},
					},
				},
				403: {
					description: "GitHub token not found",
					content: {
						"application/json": {
							schema: resolver(WorkspaceErrorSchema),
						},
					},
				},
				404: {
					description: "Workspace not found",
					content: {
						"application/json": {
							schema: resolver(WorkspaceErrorSchema),
						},
					},
				},
				500: {
					description: "Failed to refresh tokens",
					content: {
						"application/json": {
							schema: resolver(WorkspaceErrorSchema),
						},
					},
				},
			},
		}),
		workspaceMiddleware,
		async c => {
			const db = c.get("db")
			const authRow = c.get("authRow")
			const ws = c.get("workspace")

			const accessToken = await getGitHubAccessToken(db, authRow.userId)
			if (!accessToken) return c.json({ error: "GitHub token not found" }, 403)

			const octokit = getOctokit(accessToken)
			const [owner, repo] = ws.githubRepo.split("/")

			let publicKey: { key: string; key_id: string }
			try {
				const { data } = await octokit.actions.getRepoPublicKey({
					owner: owner!,
					repo: repo!,
				})
				publicKey = data
			} catch {
				return c.json({ error: "Failed to get repo public key" }, 500)
			}

			let smitheryApiKey = false
			let flamecastApiKey = false

			// Rotate SMITHERY_API_KEY
			try {
				const smitheryClient = createSmitheryClient(c.env.SMITHERY_API_KEY)
				const smitheryToken = await createConnectionToken(smitheryClient, ws.id)
				const encrypted = encryptSecret(smitheryToken, publicKey.key)
				await octokit.actions.createOrUpdateRepoSecret({
					owner: owner!,
					repo: repo!,
					secret_name: "SMITHERY_API_KEY",
					encrypted_value: encrypted,
					key_id: publicKey.key_id,
				})
				smitheryApiKey = true
			} catch (err) {
				console.error("Failed to refresh SMITHERY_API_KEY:", err)
				trackEvent(
					c.env,
					authRow.userId,
					AnalyticsEvents.WORKSPACE_TOKENS_ROTATED,
					{ workspaceId: ws.id, smitheryApiKey, flamecastApiKey },
				)
				return c.json({ error: "Failed to refresh SMITHERY_API_KEY" }, 500)
			}

			// Rotate FLAMECAST_API_KEY
			try {
				const workos = c.get("workos")
				const [orgRow] = await db
					.select({
						organizationId: userOrganizationsTable.organizationId,
					})
					.from(userOrganizationsTable)
					.where(eq(userOrganizationsTable.userId, authRow.userId))
					.limit(1)

				if (orgRow) {
					const apiKey = await workos.organizations.createOrganizationApiKey({
						organizationId: orgRow.organizationId,
						name: ws.name || "Workspace API Key",
					})
					const encrypted = encryptSecret(apiKey.value, publicKey.key)
					await octokit.actions.createOrUpdateRepoSecret({
						owner: owner!,
						repo: repo!,
						secret_name: "FLAMECAST_API_KEY",
						encrypted_value: encrypted,
						key_id: publicKey.key_id,
					})
					flamecastApiKey = true
				}
			} catch (err) {
				console.error("Failed to refresh FLAMECAST_API_KEY:", err)
				trackEvent(
					c.env,
					authRow.userId,
					AnalyticsEvents.WORKSPACE_TOKENS_ROTATED,
					{ workspaceId: ws.id, smitheryApiKey, flamecastApiKey },
				)
				return c.json({ error: "Failed to refresh FLAMECAST_API_KEY" }, 500)
			}

			trackEvent(
				c.env,
				authRow.userId,
				AnalyticsEvents.WORKSPACE_TOKENS_ROTATED,
				{ workspaceId: ws.id, smitheryApiKey, flamecastApiKey },
			)

			return c.json({ smitheryApiKey, flamecastApiKey })
		},
	)
	.route("/:workspaceId/mcp", mcp)
	.route("/:workspaceId/skills", skills)
	.route("/:workspaceId/tasks", tasks)

export default workspaces
