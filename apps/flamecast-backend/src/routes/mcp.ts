import { Hono } from "hono"
import { validator as zValidator, describeRoute, resolver } from "hono-openapi"
import {
	AddMcpConnectionRequestSchema,
	AddMcpConnectionResponseSchema,
	ListMcpConnectionsResponseSchema,
	McpSessionTokenRequestSchema,
	McpSessionTokenResponseSchema,
	RemoveMcpConnectionResponseSchema,
	McpErrorSchema,
} from "@flamecast/api-schemas"
import {
	createSmitheryClient,
	addConnection,
	removeConnection,
	listConnections,
	createConnectionSessionToken,
	resolveServerUrl,
	resolveServerSlug,
} from "../lib/smithery"
import { workspaceMiddleware, type WorkspaceEnv } from "../lib/middleware"
import { trackEvent, AnalyticsEvents } from "../lib/analytics"

const mcp = new Hono<WorkspaceEnv>()
	.use(workspaceMiddleware)
	.post(
		"/",
		describeRoute({
			description: "Add an MCP server connection to a workspace.",
			tags: ["mcp"],
			responses: {
				200: {
					description: "Connection added",
					content: {
						"application/json": {
							schema: resolver(AddMcpConnectionResponseSchema),
						},
					},
				},
				400: {
					description: "Invalid request",
					content: {
						"application/json": {
							schema: resolver(McpErrorSchema),
						},
					},
				},
				500: {
					description: "Internal error",
					content: {
						"application/json": {
							schema: resolver(McpErrorSchema),
						},
					},
				},
			},
		}),
		zValidator("json", AddMcpConnectionRequestSchema),
		async c => {
			const ws = c.get("workspace")
			const authRow = c.get("authRow")

			const { server, connectionId } = c.req.valid("json")

			const smitheryClient = createSmitheryClient(c.env.SMITHERY_API_KEY)

			const result = await addConnection(
				smitheryClient,
				server,
				ws.id,
				connectionId,
			)

			if (result.status === "error") {
				return c.json(
					{ error: result.error ?? "Failed to add connection" },
					400,
				)
			}

			trackEvent(c.env, authRow.userId, AnalyticsEvents.MCP_CONNECTION_ADDED, {
				workspaceId: ws.id,
				server,
			})

			return c.json({
				connection: {
					server,
					status: result.status,
					...(result.connectionId && { connectionId: result.connectionId }),
					...(result.authorizationUrl && {
						authorizationUrl: result.authorizationUrl,
					}),
				},
			})
		},
	)
	.get(
		"/",
		describeRoute({
			description: "List MCP connections for a workspace.",
			tags: ["mcp"],
			responses: {
				200: {
					description: "List of connections",
					content: {
						"application/json": {
							schema: resolver(ListMcpConnectionsResponseSchema),
						},
					},
				},
			},
		}),
		async c => {
			const ws = c.get("workspace")
			const smitheryClient = createSmitheryClient(c.env.SMITHERY_API_KEY)
			const conns = await listConnections(smitheryClient, ws.id)

			return c.json({
				connections: conns.map(conn => ({
					server: resolveServerSlug(conn.mcpUrl),
					mcpUrl: conn.mcpUrl,
					status:
						conn.status?.state === "connected"
							? ("ready" as const)
							: (conn.status?.state ?? ("ready" as const)),
				})),
			})
		},
	)
	.post(
		"/token",
		describeRoute({
			description:
				"Create a short-lived Smithery token scoped to this workspace's MCP connections.",
			tags: ["mcp"],
			responses: {
				200: {
					description: "Token created",
					content: {
						"application/json": {
							schema: resolver(McpSessionTokenResponseSchema),
						},
					},
				},
				400: {
					description: "Invalid request",
					content: {
						"application/json": {
							schema: resolver(McpErrorSchema),
						},
					},
				},
				500: {
					description: "Internal error",
					content: {
						"application/json": {
							schema: resolver(McpErrorSchema),
						},
					},
				},
			},
		}),
		zValidator("json", McpSessionTokenRequestSchema),
		async c => {
			const ws = c.get("workspace")
			const { ttlSeconds: requestedTtlSeconds } = c.req.valid("json")
			const ttlSeconds = requestedTtlSeconds ?? 300

			try {
				const smitheryClient = createSmitheryClient(c.env.SMITHERY_API_KEY)
				const token = await createConnectionSessionToken(
					smitheryClient,
					ws.id,
					ttlSeconds,
				)
				return c.json(token)
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Failed to create MCP token"
				return c.json({ error: message }, 500)
			}
		},
	)
	.delete(
		"/:server",
		describeRoute({
			description: "Remove an MCP connection from a workspace.",
			tags: ["mcp"],
			responses: {
				200: {
					description: "Connection removed",
					content: {
						"application/json": {
							schema: resolver(RemoveMcpConnectionResponseSchema),
						},
					},
				},
				404: {
					description: "Connection not found",
					content: {
						"application/json": {
							schema: resolver(McpErrorSchema),
						},
					},
				},
			},
		}),
		async c => {
			const ws = c.get("workspace")
			const authRow = c.get("authRow")
			const server = c.req.param("server")!

			const smitheryClient = createSmitheryClient(c.env.SMITHERY_API_KEY)
			const conns = await listConnections(smitheryClient, ws.id)
			const mcpUrl = resolveServerUrl(server)
			const conn = conns.find(c => c.mcpUrl === mcpUrl)

			if (!conn) {
				return c.json({ error: "Connection not found" }, 404)
			}

			await removeConnection(smitheryClient, conn.connectionId)

			trackEvent(
				c.env,
				authRow.userId,
				AnalyticsEvents.MCP_CONNECTION_REMOVED,
				{ workspaceId: ws.id, server },
			)

			return c.json({ success: true })
		},
	)

export default mcp
