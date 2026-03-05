import type Smithery from "@smithery/api"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useApiClient, useApiClientOrNull } from "./api-context"
import { queryKeys } from "./queries"
import {
	SMITHERY_NAMESPACE,
	type WorkspaceMcpConnection,
	mapSmitheryConnection,
	resolveServerUrl,
} from "./smithery-mcp"

export function useCreateApiKey() {
	const client = useApiClient()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (params: { name?: string }) => client.apiKeys.create(params),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all })
		},
	})
}

export function useDeleteApiKey() {
	const client = useApiClient()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (id: string) => client.apiKeys.delete(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all })
		},
	})
}

export function useCreateWorkspace() {
	const client = useApiClient()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (params: {
			name: string
			systemPrompt?: string
			secrets?: Record<string, string>
			tools?: string[]
		}) => client.workspaces.create(params),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
		},
	})
}

export function useDeleteWorkspace() {
	const client = useApiClient()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (workspaceId: string) => {
			const res = await client.workspaces.delete(workspaceId)
			return res as typeof res & { repoDeleted: boolean }
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
		},
	})
}

export function useCreateTask(workspaceId: string) {
	const client = useApiClient()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (params: {
			prompt: string
			context?: Array<{ source: string; source_id: string }>
		}) => client.workspaces.tasks.create(workspaceId, params),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.tasks.all(workspaceId),
			})
		},
	})
}

export function useArchiveTask(workspaceId: string) {
	const client = useApiClientOrNull()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (taskId: string) => {
			if (!client) throw new Error("API client not ready")
			return client.workspaces.tasks.archive(taskId, { workspaceId })
		},
		onMutate: async taskId => {
			await queryClient.cancelQueries({
				queryKey: queryKeys.tasks.all(workspaceId),
			})

			const previousTaskLists = queryClient.getQueriesData({
				queryKey: queryKeys.tasks.all(workspaceId),
			})
			const previousTaskDetail = queryClient.getQueryData(
				queryKeys.tasks.detail(workspaceId, taskId),
			)

			queryClient.setQueriesData(
				{ queryKey: queryKeys.tasks.all(workspaceId) },
				(current: unknown) => {
					if (
						!current ||
						typeof current !== "object" ||
						!("tasks" in current) ||
						!Array.isArray(current.tasks)
					) {
						return current
					}

					return {
						...current,
						tasks: current.tasks.map((task: { id: string; status: string }) =>
							task.id === taskId ? { ...task, status: "archived" } : task,
						),
					}
				},
			)

			queryClient.setQueryData(
				queryKeys.tasks.detail(workspaceId, taskId),
				(current: unknown) => {
					if (
						!current ||
						typeof current !== "object" ||
						!("task" in current) ||
						!current.task ||
						typeof current.task !== "object"
					) {
						return current
					}

					return {
						...current,
						task: {
							...current.task,
							status: "archived",
						},
					}
				},
			)

			return { previousTaskLists, previousTaskDetail, taskId }
		},
		onError: (_error, _taskId, context) => {
			if (!context) return

			for (const [queryKey, data] of context.previousTaskLists) {
				queryClient.setQueryData(queryKey, data)
			}

			queryClient.setQueryData(
				queryKeys.tasks.detail(workspaceId, context.taskId),
				context.previousTaskDetail,
			)
		},
		onSettled: (_result, _error, taskId) => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.tasks.all(workspaceId),
			})
			queryClient.invalidateQueries({
				queryKey: queryKeys.tasks.detail(workspaceId, taskId),
			})
		},
	})
}

export function useUnarchiveTask(workspaceId: string) {
	const client = useApiClientOrNull()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (taskId: string) => {
			if (!client) throw new Error("API client not ready")
			return client.workspaces.tasks.unarchive(taskId, { workspaceId })
		},
		onSettled: (_result, _error, taskId) => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.tasks.all(workspaceId),
			})
			queryClient.invalidateQueries({
				queryKey: queryKeys.tasks.detail(workspaceId, taskId),
			})
		},
	})
}

export function useSetDefaultWorkspace() {
	const client = useApiClient()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (workspaceId: string) =>
			client.workspaces.default.set({ workspaceId }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.workspaces.default,
			})
		},
	})
}

export function useSetSecrets(workspaceId: string) {
	const client = useApiClient()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (secrets: Record<string, string>) =>
			client.workspaces.secrets.set(workspaceId, { secrets }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.workspaces.detail(workspaceId),
			})
		},
	})
}

export function useSyncWorkflows(workspaceId: string) {
	const client = useApiClient()
	return useMutation({
		mutationFn: () => client.workspaces.syncWorkflows.sync(workspaceId),
	})
}

export function useRotateTokens(workspaceId: string) {
	const client = useApiClient()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: () => client.workspaces.secrets.refresh(workspaceId),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.workspaces.detail(workspaceId),
			})
		},
	})
}

export function useAddMcpConnection(
	workspaceId: string,
	smithery: Smithery | null,
) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (params: {
			server: string
			connectionId?: string
		}): Promise<{ connection: WorkspaceMcpConnection }> => {
			if (!smithery) throw new Error("Smithery client not ready")
			const mcpUrl = resolveServerUrl(params.server)
			const body = { mcpUrl, metadata: { workspaceId } }
			const connection = params.connectionId
				? await smithery.connections.set(params.connectionId, {
						namespace: SMITHERY_NAMESPACE,
						...body,
					})
				: await smithery.connections.create(SMITHERY_NAMESPACE, body)
			return { connection: mapSmitheryConnection(connection) }
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.mcp.all(workspaceId),
			})
		},
	})
}

export function useRemoveMcpConnection(
	workspaceId: string,
	smithery: Smithery | null,
) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (connectionId: string) => {
			if (!smithery) throw new Error("Smithery client not ready")
			await smithery.connections.delete(connectionId, {
				namespace: SMITHERY_NAMESPACE,
			})
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.mcp.all(workspaceId),
			})
		},
	})
}

export function useAddSkill(workspaceId: string) {
	const client = useApiClient()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (params: { skill: string }) =>
			client.workspaces.skills.add(workspaceId, params),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.skills.all(workspaceId),
			})
		},
	})
}

export function useRemoveSkill(workspaceId: string) {
	const client = useApiClient()
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (skill: string) =>
			client.workspaces.skills.remove(skill, { workspaceId }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.skills.all(workspaceId),
			})
		},
	})
}
