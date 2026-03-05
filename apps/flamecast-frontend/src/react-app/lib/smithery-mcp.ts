import Smithery from "@smithery/api"
import type { Connection } from "@smithery/api/resources/connections"
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useApiClient } from "./api-context"

export const SMITHERY_NAMESPACE = "flamecast"
const SMITHERY_URL_PREFIX = "https://server.smithery.ai/"
const SMITHERY_URL_SUFFIX = "/mcp"
const MCP_SESSION_TTL_SECONDS = 300
const MCP_TOKEN_REFRESH_BUFFER_MS = 60_000

export function resolveServerUrl(server: string): string {
	if (server.startsWith("https://") || server.startsWith("http://")) {
		return server
	}
	return `${SMITHERY_URL_PREFIX}${server}${SMITHERY_URL_SUFFIX}`
}

export function resolveServerSlug(mcpUrl: string): string {
	if (
		mcpUrl.startsWith(SMITHERY_URL_PREFIX) &&
		mcpUrl.endsWith(SMITHERY_URL_SUFFIX)
	) {
		return mcpUrl.slice(SMITHERY_URL_PREFIX.length, -SMITHERY_URL_SUFFIX.length)
	}
	return mcpUrl
}

export type WorkspaceMcpConnection = {
	server: string
	status: "ready" | "auth_required" | "error"
	connectionId?: string
	mcpUrl?: string
	authorizationUrl?: string
}

export function mapSmitheryConnection(
	connection: Connection,
): WorkspaceMcpConnection {
	const state = connection.status?.state
	return {
		server: resolveServerSlug(connection.mcpUrl),
		status: state === "connected" ? "ready" : (state ?? "ready"),
		connectionId: connection.connectionId,
		mcpUrl: connection.mcpUrl,
		authorizationUrl:
			connection.status && "authorizationUrl" in connection.status
				? connection.status.authorizationUrl
				: undefined,
	}
}

const TOKEN_STALE_TIME =
	MCP_SESSION_TTL_SECONDS * 1000 - MCP_TOKEN_REFRESH_BUFFER_MS

export const smitheryTokenKey = (workspaceId: string) =>
	["smithery-token", workspaceId] as const

export function useSmitheryClient(workspaceId: string): Smithery | null {
	const client = useApiClient()

	const { data: tokenData } = useQuery({
		queryKey: smitheryTokenKey(workspaceId),
		queryFn: () =>
			client.workspaces.mcp.createToken(workspaceId, {
				ttlSeconds: MCP_SESSION_TTL_SECONDS,
			}),
		staleTime: TOKEN_STALE_TIME,
		refetchInterval: TOKEN_STALE_TIME,
	})

	return useMemo(
		() => (tokenData ? new Smithery({ apiKey: tokenData.token }) : null),
		[tokenData?.token],
	)
}
