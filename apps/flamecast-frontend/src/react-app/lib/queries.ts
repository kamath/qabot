import type Smithery from "@smithery/api"
import { queryOptions } from "@tanstack/react-query"
import type Flamecast from "@flamecast/api"
import type { TaskListParams } from "@flamecast/api/resources/workspaces/tasks"
import { SMITHERY_NAMESPACE, mapSmitheryConnection } from "./smithery-mcp"

export const queryKeys = {
	github: {
		user: ["github", "user"] as const,
	},
	workspaces: {
		all: ["workspaces"] as const,
		list: () => [...queryKeys.workspaces.all, "list"] as const,
		detail: (id: string) =>
			[...queryKeys.workspaces.all, "detail", id] as const,
		default: ["workspaces", "default"] as const,
	},
	apiKeys: {
		all: ["apiKeys"] as const,
		list: () => ["apiKeys", "list"] as const,
	},
	tasks: {
		all: (workspaceId: string) => ["tasks", workspaceId] as const,
		list: (workspaceId: string, filters?: Pick<TaskListParams, "status">) =>
			["tasks", workspaceId, "list", filters] as const,
		detail: (workspaceId: string, taskId: string) =>
			["tasks", workspaceId, "detail", taskId] as const,
	},
	mcp: {
		all: (workspaceId: string) => ["mcp", workspaceId] as const,
		list: (workspaceId: string) => ["mcp", workspaceId, "list"] as const,
	},
	skills: {
		all: (workspaceId: string) => ["skills", workspaceId] as const,
		list: (workspaceId: string) => ["skills", workspaceId, "list"] as const,
	},
}

export function githubUserQuery(client: Flamecast) {
	return queryOptions({
		queryKey: queryKeys.github.user,
		queryFn: () => client.github.user(),
	})
}

export function workspacesListQuery(client: Flamecast) {
	return queryOptions({
		queryKey: queryKeys.workspaces.list(),
		queryFn: () => client.workspaces.list(),
	})
}

export function workspaceDetailQuery(client: Flamecast, workspaceId: string) {
	return queryOptions({
		queryKey: queryKeys.workspaces.detail(workspaceId),
		queryFn: () => client.workspaces.get(workspaceId),
	})
}

export function defaultWorkspaceQuery(client: Flamecast) {
	return queryOptions({
		queryKey: queryKeys.workspaces.default,
		queryFn: () => client.workspaces.default.get(),
	})
}

export function tasksListQuery(
	client: Flamecast,
	workspaceId: string,
	filters?: Pick<TaskListParams, "status">,
) {
	const status = filters?.status

	return queryOptions({
		queryKey: queryKeys.tasks.list(workspaceId, filters),
		queryFn: () =>
			client.workspaces.tasks.list(workspaceId, {
				status,
				limit: 20,
			}),
		refetchInterval: 5000,
	})
}

export function apiKeysListQuery(client: Flamecast) {
	return queryOptions({
		queryKey: queryKeys.apiKeys.list(),
		queryFn: () => client.apiKeys.list(),
	})
}

export function mcpConnectionsQuery(
	workspaceId: string,
	smithery: Smithery | null,
) {
	return queryOptions({
		queryKey: queryKeys.mcp.list(workspaceId),
		queryFn: async () => {
			const result = await smithery!.connections.list(SMITHERY_NAMESPACE, {
				"metadata.workspaceId": workspaceId,
			} as Record<string, unknown>)
			return {
				connections: result.connections.map(mapSmitheryConnection),
			}
		},
		enabled: !!smithery,
		refetchInterval: query => {
			const hasAuthRequired = query.state.data?.connections.some(
				c => c.status === "auth_required",
			)
			return hasAuthRequired ? 5000 : false
		},
	})
}

export function skillsListQuery(client: Flamecast, workspaceId: string) {
	return queryOptions({
		queryKey: queryKeys.skills.list(workspaceId),
		queryFn: () => client.workspaces.skills.list(workspaceId),
	})
}

export function taskDetailQuery(
	client: Flamecast,
	workspaceId: string,
	taskId: string,
) {
	return queryOptions({
		queryKey: queryKeys.tasks.detail(workspaceId, taskId),
		queryFn: () => client.workspaces.tasks.get(taskId, { workspaceId }),
		refetchInterval: query => {
			const status = query.state.data?.task.status
			if (
				status === "working" ||
				status === "submitted" ||
				status === "input_required"
			) {
				return 3000
			}
			return false
		},
	})
}
