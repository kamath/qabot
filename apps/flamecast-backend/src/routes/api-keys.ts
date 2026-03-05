import { Hono } from "hono"
import { z } from "zod"
import { validator as zValidator, describeRoute, resolver } from "hono-openapi"
import { userOrganizations } from "@flamecast/db/schema"
import { eq } from "drizzle-orm"
import { authMiddleware, type AuthEnv } from "../lib/middleware"
import { trackEvent, AnalyticsEvents } from "../lib/analytics"

const CreateApiKeyRequestSchema = z.object({
	name: z.string().optional(),
})

const ApiKeyIdParamSchema = z.object({
	id: z.string().min(1),
})

const ApiKeyItemSchema = z.object({
	id: z.string(),
	name: z.string(),
	obfuscatedValue: z.string(),
	createdAt: z.string(),
	lastUsedAt: z.string().nullable(),
})

const ListApiKeysResponseSchema = z.object({
	keys: z.array(ApiKeyItemSchema),
})

const CreateApiKeyResponseSchema = z.object({
	key: z.string(),
	id: z.string(),
})

const DeleteApiKeyResponseSchema = z.object({
	success: z.boolean(),
})

const ApiKeyErrorSchema = z.object({
	error: z.string(),
})

const apiKeys = new Hono<AuthEnv>()
	.use(authMiddleware)
	.get(
		"/",
		describeRoute({
			description:
				"List all API keys for the authenticated user's organization.",
			tags: ["api-keys"],
			responses: {
				200: {
					description: "List of API keys",
					content: {
						"application/json": {
							schema: resolver(ListApiKeysResponseSchema),
						},
					},
				},
			},
		}),
		async c => {
			const db = c.get("db")
			const workos = c.get("workos")
			const authRow = c.get("authRow")

			const [orgRow] = await db
				.select({ organizationId: userOrganizations.organizationId })
				.from(userOrganizations)
				.where(eq(userOrganizations.userId, authRow.userId))
				.limit(1)

			if (!orgRow) return c.json({ keys: [] })

			const result = await workos.organizations.listOrganizationApiKeys({
				organizationId: orgRow.organizationId,
			})

			const keys = result.data.map(k => ({
				id: k.id,
				name: k.name,
				obfuscatedValue: k.obfuscatedValue,
				createdAt: k.createdAt,
				lastUsedAt: k.lastUsedAt,
			}))

			return c.json({ keys })
		},
	)
	.post(
		"/",
		describeRoute({
			description: "Create a new API key.",
			tags: ["api-keys"],
			responses: {
				200: {
					description: "API key created successfully",
					content: {
						"application/json": {
							schema: resolver(CreateApiKeyResponseSchema),
						},
					},
				},
				500: {
					description: "Organization not found",
					content: {
						"application/json": {
							schema: resolver(ApiKeyErrorSchema),
						},
					},
				},
			},
		}),
		zValidator("json", CreateApiKeyRequestSchema),
		async c => {
			const db = c.get("db")
			const workos = c.get("workos")
			const authRow = c.get("authRow")

			const { name } = c.req.valid("json")

			const [orgRow] = await db
				.select({ organizationId: userOrganizations.organizationId })
				.from(userOrganizations)
				.where(eq(userOrganizations.userId, authRow.userId))
				.limit(1)

			if (!orgRow) return c.json({ error: "Organization not found" }, 500)

			const key = await workos.organizations.createOrganizationApiKey({
				organizationId: orgRow.organizationId,
				name: name || "API Key",
			})

			trackEvent(c.env, authRow.userId, AnalyticsEvents.API_KEY_CREATED, {
				name: name || "API Key",
			})

			return c.json({ key: key.value, id: key.id })
		},
	)
	.delete(
		"/:id",
		describeRoute({
			description: "Delete an API key by ID.",
			tags: ["api-keys"],
			responses: {
				200: {
					description: "API key deleted",
					content: {
						"application/json": {
							schema: resolver(DeleteApiKeyResponseSchema),
						},
					},
				},
			},
		}),
		zValidator("param", ApiKeyIdParamSchema),
		async c => {
			const workos = c.get("workos")
			const authRow = c.get("authRow")
			const { id } = c.req.valid("param")

			await workos.apiKeys.deleteApiKey(id)

			trackEvent(c.env, authRow.userId, AnalyticsEvents.API_KEY_DELETED, {
				keyId: id,
			})

			return c.json({ success: true })
		},
	)

export default apiKeys
