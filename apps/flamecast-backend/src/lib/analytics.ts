import { createPostHogClient } from "./posthog"

export const AnalyticsEvents = {
	WORKSPACE_CREATED: "workspace_created",
	WORKSPACE_DELETED: "workspace_deleted",
	WORKSPACE_DEFAULT_SET: "workspace_default_set",
	WORKSPACE_SECRETS_UPDATED: "workspace_secrets_updated",
	WORKSPACE_WORKFLOWS_SYNCED: "workspace_workflows_synced",
	WORKSPACE_TOKENS_ROTATED: "workspace_tokens_rotated",
	TASK_CREATED: "task_created",
	API_KEY_CREATED: "api_key_created",
	API_KEY_DELETED: "api_key_deleted",
	SKILL_ADDED: "skill_added",
	SKILL_REMOVED: "skill_removed",
	MCP_CONNECTION_ADDED: "mcp_connection_added",
	MCP_CONNECTION_REMOVED: "mcp_connection_removed",
	USER_LOGGED_IN: "user_logged_in",
} as const

export function trackEvent(
	env: { POSTHOG_KEY?: string; POSTHOG_HOST?: string },
	distinctId: string,
	event: (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents],
	properties?: Record<string, unknown>,
) {
	if (!env.POSTHOG_KEY) return
	const posthog = createPostHogClient(env.POSTHOG_KEY, env.POSTHOG_HOST)
	posthog.capture({ distinctId, event, properties })
}
