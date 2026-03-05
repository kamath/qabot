import Smithery, { APIError } from "@smithery/api"
import type { Connection } from "@smithery/api/resources/connections"

/** Single namespace for all flamecast connections. */
const NAMESPACE = "flamecast"

/** Create a Smithery API client from the platform API key. */
export function createSmitheryClient(apiKey: string): Smithery {
	return new Smithery({ apiKey })
}

type ConnectionTokenOperation = "read" | "write" | "execute"
const DEFAULT_CONNECTION_SESSION_TTL_SECONDS = 300

async function createScopedConnectionToken(
	client: Smithery,
	workspaceId: string,
	operations: ConnectionTokenOperation[],
	ttl: string,
): Promise<{ token: string; expiresAt: string }> {
	const result = await client.tokens.create({
		policy: [
			{
				namespaces: [NAMESPACE],
				resources: ["connections", "servers", "skills"],
				operations,
				metadata: { workspaceId },
				ttl,
			},
		],
	})
	return { token: result.token, expiresAt: result.expiresAt }
}

const SMITHERY_URL_PREFIX = "https://server.smithery.ai/"
const SMITHERY_URL_SUFFIX = "/mcp"

/**
 * Resolve a server identifier to an MCP URL.
 * If it looks like a URL, use it directly. Otherwise treat it as a
 * Smithery registry slug (e.g. "linear" → "https://server.smithery.ai/linear/mcp").
 */
export function resolveServerUrl(server: string): string {
	if (server.startsWith("https://") || server.startsWith("http://")) {
		return server
	}
	return `${SMITHERY_URL_PREFIX}${server}${SMITHERY_URL_SUFFIX}`
}

/**
 * Reverse of resolveServerUrl — extract the slug from a Smithery MCP URL.
 * Non-Smithery URLs are returned as-is.
 */
export function resolveServerSlug(mcpUrl: string): string {
	if (
		mcpUrl.startsWith(SMITHERY_URL_PREFIX) &&
		mcpUrl.endsWith(SMITHERY_URL_SUFFIX)
	) {
		return mcpUrl.slice(SMITHERY_URL_PREFIX.length, -SMITHERY_URL_SUFFIX.length)
	}
	return mcpUrl
}

/**
 * List all connections for a user in the flamecast namespace.
 */
export async function listConnections(
	client: Smithery,
	workspaceId: string,
): Promise<Connection[]> {
	const result = await client.connections.list(NAMESPACE, {
		"metadata.workspaceId": workspaceId,
	} as Record<string, unknown>) // metadata filtering is documented but not typed in SDK
	return result.connections
}

/**
 * Add a connection for a server, scoped to a user via metadata.
 * Uses the connections API directly (not createConnection SDK helper)
 * so we can attach workspaceId metadata for token scoping.
 */
export async function addConnection(
	client: Smithery,
	server: string,
	workspaceId: string,
	connectionId?: string,
): Promise<{
	status: "ready" | "auth_required" | "error"
	authorizationUrl?: string
	connectionId?: string
	error?: string
}> {
	try {
		const mcpUrl = resolveServerUrl(server)
		const metadata = { workspaceId }

		let conn: Connection
		if (connectionId) {
			conn = await client.connections.set(connectionId, {
				namespace: NAMESPACE,
				mcpUrl,
				metadata,
			})
		} else {
			conn = await client.connections.create(NAMESPACE, {
				mcpUrl,
				metadata,
			})
		}

		if (conn.status?.state === "auth_required") {
			return {
				status: "auth_required",
				authorizationUrl: conn.status.authorizationUrl ?? undefined,
				connectionId: conn.connectionId,
			}
		}

		if (conn.status?.state === "error") {
			return {
				status: "error",
				error: conn.status.message ?? "Connection failed",
				connectionId: conn.connectionId,
			}
		}

		return {
			status: "ready",
			connectionId: conn.connectionId,
		}
	} catch (err) {
		return {
			status: "error",
			error: err instanceof Error ? err.message : "Failed to add connection",
		}
	}
}

/**
 * Preflight check all connections.
 * Checks status on each Connection object (already fetched from API).
 */
export function preflightConnections(connections: Connection[]): {
	ready: string[]
	authRequired: Array<{ server: string; authorizationUrl: string }>
	errors: Array<{ server: string; error: string }>
} {
	const ready: string[] = []
	const authRequired: Array<{ server: string; authorizationUrl: string }> = []
	const errors: Array<{ server: string; error: string }> = []

	for (const conn of connections) {
		const server = resolveServerSlug(conn.mcpUrl)

		if (conn.status?.state === "auth_required") {
			if (conn.status.authorizationUrl) {
				authRequired.push({
					server,
					authorizationUrl: conn.status.authorizationUrl,
				})
			} else {
				errors.push({
					server,
					error: "Authorization required but no URL provided",
				})
			}
		} else if (conn.status?.state === "error") {
			errors.push({
				server,
				error: conn.status.message ?? "Connection error",
			})
		} else {
			ready.push(server)
		}
	}

	return { ready, authRequired, errors }
}

/** Remove a connection. */
export async function removeConnection(
	client: Smithery,
	connectionId: string,
): Promise<void> {
	try {
		await client.connections.delete(connectionId, { namespace: NAMESPACE })
	} catch (err) {
		if (err instanceof APIError && err.status === 404) return
		throw err
	}
}

/**
 * Create a service token scoped to a specific workspace's connections.
 * The token can only access connections with matching workspaceId metadata.
 */
export async function createConnectionToken(
	client: Smithery,
	workspaceId: string,
): Promise<string> {
	const { token } = await createScopedConnectionToken(
		client,
		workspaceId,
		["read", "write", "execute"],
		"90d",
	)
	return token
}

/**
 * Create a short-lived token for browser-based MCP connection management.
 */
export async function createConnectionSessionToken(
	client: Smithery,
	workspaceId: string,
	ttlSeconds = DEFAULT_CONNECTION_SESSION_TTL_SECONDS,
): Promise<{ token: string; expiresAt: string }> {
	return createScopedConnectionToken(
		client,
		workspaceId,
		["read", "write", "execute"],
		`${ttlSeconds}s`,
	)
}
