import { z } from "zod"

// --- MCP connection item ---

export const McpConnectionItemSchema = z
	.object({
		server: z.string().meta({ description: "Server slug or URL" }),
		status: z
			.enum(["ready", "auth_required", "error"])
			.meta({ description: "Connection status" }),
		connectionId: z.string().optional().meta({
			description: "Smithery connection ID",
		}),
		mcpUrl: z.string().url().optional().meta({
			description: "Resolved MCP server URL",
		}),
		authorizationUrl: z.string().url().optional().meta({
			description: "OAuth authorization URL (when status is auth_required)",
		}),
	})
	.meta({ id: "McpConnectionItem" })

// --- POST /workspaces/:workspaceId/mcp ---

export const AddMcpConnectionRequestSchema = z
	.object({
		server: z.string().min(1).meta({
			description:
				"Smithery registry slug (e.g. 'linear') or full MCP server URL",
		}),
		connectionId: z.string().optional().meta({
			description:
				"Existing Smithery connection ID (for re-verification after OAuth)",
		}),
	})
	.meta({ id: "AddMcpConnectionRequest" })

export const AddMcpConnectionResponseSchema = z
	.object({
		connection: McpConnectionItemSchema,
	})
	.meta({ id: "AddMcpConnectionResponse" })

// --- GET /workspaces/:workspaceId/mcp ---

export const ListMcpConnectionsResponseSchema = z
	.object({
		connections: z.array(McpConnectionItemSchema),
	})
	.meta({ id: "ListMcpConnectionsResponse" })

// --- POST /workspaces/:workspaceId/mcp/token ---

export const McpSessionTokenRequestSchema = z
	.object({
		ttlSeconds: z.int().positive().max(300).optional().meta({
			description:
				"Requested token TTL in seconds. Defaults to 300 and cannot exceed 300.",
		}),
	})
	.meta({ id: "McpSessionTokenRequest" })

export const McpSessionTokenResponseSchema = z
	.object({
		token: z
			.string()
			.meta({ description: "Short-lived Smithery service token" }),
		expiresAt: z
			.string()
			.meta({ description: "ISO 8601 expiration timestamp" }),
	})
	.meta({ id: "McpSessionTokenResponse" })

// --- DELETE /workspaces/:workspaceId/mcp/:connectionName ---

export const RemoveMcpConnectionResponseSchema = z
	.object({
		success: z.boolean(),
	})
	.meta({ id: "RemoveMcpConnectionResponse" })

// --- Preflight response (returned as 428 from task creation) ---

export const McpPreflightResponseSchema = z
	.object({
		ready: z.array(z.string()).meta({ description: "Authorized connections" }),
		authRequired: z
			.array(
				z.object({
					server: z.string(),
					authorizationUrl: z.string().url(),
				}),
			)
			.meta({ description: "Connections requiring OAuth" }),
		errors: z
			.array(
				z.object({
					server: z.string(),
					error: z.string(),
				}),
			)
			.meta({ description: "Connections with errors" }),
	})
	.meta({ id: "McpPreflightResponse" })

// --- Error ---

export const McpErrorSchema = z
	.object({
		error: z.string().meta({ example: "Connection not found" }),
	})
	.meta({ id: "McpError" })

// MCP schemas for OpenAPI injection
export const mcpSchemas = [
	McpConnectionItemSchema,
	AddMcpConnectionRequestSchema,
	AddMcpConnectionResponseSchema,
	ListMcpConnectionsResponseSchema,
	McpSessionTokenRequestSchema,
	McpSessionTokenResponseSchema,
	RemoveMcpConnectionResponseSchema,
	McpPreflightResponseSchema,
	McpErrorSchema,
]
