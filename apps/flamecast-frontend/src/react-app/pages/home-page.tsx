import { useEffect, useMemo, useState } from "react"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { useApiClientOrNull } from "@/lib/api-context"
import { useAuth } from "@/lib/auth-context"
import {
	defaultWorkspaceQuery,
	workspacesListQuery,
	queryKeys,
} from "@/lib/queries"
import { useTrackPageView } from "@/lib/analytics"
import { Button } from "@/components/ui/button"
import { DispatchForm, type ContextItem } from "@/components/dispatch-form"
import { MASCOT_PNG_FILEPATH } from "@/lib/consts"

const RUNNING_MASCOT_FILEPATH = "/brand/Mascot/mascot_running.webp"

function useRandomMascot() {
	return useMemo(() => {
		const n = Math.floor(Math.random() * 10) + 1
		return `${MASCOT_PNG_FILEPATH}/Mascot_${String(n).padStart(2, "0")}.png`
	}, [])
}

function HomeContent({
	defaultWorkspaceId,
	workspaces,
	isLoaded,
	isAuthenticated,
	isAuthLoading,
	contextItems,
	onAddContext,
	onRemoveContext,
	onSubmit,
	isSubmitting,
	submitError,
	suggestedRepos,
}: {
	defaultWorkspaceId: string | undefined
	workspaces: { id: string; name: string }[]
	isLoaded: boolean
	isAuthenticated: boolean
	isAuthLoading: boolean
	contextItems: ContextItem[]
	onAddContext: (item: ContextItem) => void
	onRemoveContext: (item: ContextItem) => void
	onSubmit: (prompt: string) => void
	isSubmitting: boolean
	submitError: boolean
	suggestedRepos: string[]
}) {
	const defaultMascotSrc = useRandomMascot()
	const mascotSrc = isSubmitting ? RUNNING_MASCOT_FILEPATH : defaultMascotSrc
	const [prompt, setPrompt] = useState("")
	const defaultWorkspace = workspaces.find(ws => ws.id === defaultWorkspaceId)

	// Data loaded: no workspaces at all (only show for authenticated users)
	if (isAuthenticated && isLoaded && workspaces.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[calc(100dvh-8rem)] gap-4">
				<img
					src={mascotSrc}
					alt="Flamecast"
					className="size-24 object-contain"
				/>
				<h1 className="text-2xl font-bold">Welcome to Flamecast</h1>
				<p className="text-muted-foreground text-center max-w-md">
					Create your first workspace to start dispatching tasks to AI agents.
				</p>
				<Button asChild>
					<Link to="/workspaces">Get Started</Link>
				</Button>
			</div>
		)
	}

	// Data loaded: workspaces exist but no default set (only show for authenticated users)
	if (isAuthenticated && isLoaded && !defaultWorkspace) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[calc(100dvh-8rem)] gap-4">
				<img
					src={mascotSrc}
					alt="Flamecast"
					className="size-24 object-contain"
				/>
				<h1 className="text-2xl font-bold">Set a default workspace</h1>
				<p className="text-muted-foreground text-center max-w-md">
					Choose a default workspace to dispatch tasks from the home page.
				</p>
				<Button asChild>
					<Link to="/workspaces">Go to Workspaces</Link>
				</Button>
			</div>
		)
	}

	function handleSubmit(promptText: string) {
		onSubmit(promptText)
		setPrompt("")
	}

	const dispatchFormProps = {
		workspaceId: defaultWorkspace?.id ?? null,
		workspaceName: defaultWorkspace?.name ?? null,
		prompt,
		setPrompt,
		onSubmit: handleSubmit,
		isSubmitting,
		submitError,
		isAuthenticated,
		isAuthLoading,
		contextItems,
		onAddContext,
		onRemoveContext,
		suggestedRepos,
	}

	return (
		<>
			{/* Desktop layout: centered vertically */}
			<div className="hidden md:flex flex-col items-center min-h-[calc(100dvh-8rem)]">
				<div className="flex-1 max-h-[20vh]" />
				<img
					src={mascotSrc}
					alt="Flamecast"
					className="size-24 object-contain mb-6"
				/>
				<DispatchForm {...dispatchFormProps} />
				<div className="flex-1" />
			</div>

			{/* Mobile layout: tasks on top, textbox fixed to bottom */}
			<div className="flex md:hidden flex-col -m-4 h-[calc(100dvh-3.5rem)]">
				<div className="flex-1 overflow-y-auto px-4">
					<div className="flex flex-col items-center pt-4">
						<img
							src={mascotSrc}
							alt="Flamecast"
							className="size-16 object-contain mb-4"
						/>
					</div>
				</div>
				<div className="shrink-0 border-t bg-background px-4 py-3">
					<DispatchForm {...dispatchFormProps} />
				</div>
			</div>
		</>
	)
}

export function HomePage() {
	useDocumentTitle()
	useTrackPageView("home")
	const client = useApiClientOrNull()
	const { user, isLoading: authLoading } = useAuth()
	const isAuthenticated = !!user
	const queryClient = useQueryClient()
	const navigate = useNavigate()

	const { data: defaultData, isLoading: defaultLoading } = useQuery({
		...defaultWorkspaceQuery(client!),
		enabled: !!client,
	})
	const { data: workspacesData, isLoading: workspacesLoading } = useQuery({
		...workspacesListQuery(client!),
		enabled: !!client,
	})

	const { runId } = useSearch({ from: "/" })
	const [contextItems, setContextItems] = useState<ContextItem[]>(
		runId ? [{ source: "flamecast_run", source_id: runId }] : [],
	)

	useEffect(() => {
		if (runId) {
			setContextItems(prev => {
				const already = prev.some(
					i => i.source === "flamecast_run" && i.source_id === runId,
				)
				return already
					? prev
					: [...prev, { source: "flamecast_run", source_id: runId }]
			})
		}
	}, [runId])

	const defaultWorkspaceId = defaultData?.defaultWorkspaceId
	const workspaceId = defaultWorkspaceId ?? ""

	const createTask = useMutation({
		mutationFn: (params: { prompt: string; context?: ContextItem[] }) => {
			if (!client) throw new Error("Not authenticated")
			return client.workspaces.tasks.create(workspaceId, params)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.tasks.all(workspaceId),
			})
		},
	})

	const isLoaded =
		!authLoading &&
		(!isAuthenticated || (!defaultLoading && !workspacesLoading))
	const workspaces = (workspacesData?.workspaces ?? []).map(ws => ({
		id: ws.id,
		name: ws.name,
	}))

	const suggestedRepos = useMemo(
		() =>
			(workspacesData?.workspaces ?? [])
				.map(ws => (ws as unknown as { githubRepo?: string }).githubRepo)
				.filter((r): r is string => typeof r === "string" && r.length > 0),
		[workspacesData],
	)

	function handleAddContext(item: ContextItem) {
		setContextItems(prev => {
			const key = `${item.source}:${item.source_id}`
			const already = prev.some(i => `${i.source}:${i.source_id}` === key)
			return already ? prev : [...prev, item]
		})
	}

	function handleRemoveContext(item: ContextItem) {
		setContextItems(prev =>
			prev.filter(
				i => !(i.source === item.source && i.source_id === item.source_id),
			),
		)
		// If removing the runId from URL search, clear the URL
		if (runId && item.source === "flamecast_run" && item.source_id === runId) {
			navigate({ to: "/", search: {} })
		}
	}

	function handleSubmit(prompt: string) {
		// Prepend run references to prompt for backward compat
		const runRefs = contextItems.filter(i => i.source === "flamecast_run")
		const prefix = runRefs
			.map(r => `reference run ${r.source_id} for more details`)
			.join("\n")
		const finalPrompt = prefix ? `${prefix}\n\n${prompt}` : prompt

		createTask.mutate(
			{
				prompt: finalPrompt,
				context: contextItems.length > 0 ? contextItems : undefined,
			},
			{
				onSuccess: data => {
					const taskId = (data as { id: string }).id
					if (taskId) {
						queryClient.setQueryData(
							queryKeys.tasks.detail(workspaceId, taskId),
							{ task: data, messages: [], outputs: null },
						)
						navigate({
							to: "/workspaces/$workspaceId/tasks/$taskId",
							params: { workspaceId, taskId },
						})
					}
				},
			},
		)
		setContextItems([])
	}

	return (
		<HomeContent
			defaultWorkspaceId={defaultWorkspaceId ?? undefined}
			workspaces={workspaces}
			isLoaded={isLoaded}
			isAuthenticated={isAuthenticated}
			isAuthLoading={authLoading}
			contextItems={contextItems}
			onAddContext={handleAddContext}
			onRemoveContext={handleRemoveContext}
			onSubmit={handleSubmit}
			isSubmitting={createTask.isPending}
			submitError={createTask.isError}
			suggestedRepos={suggestedRepos}
		/>
	)
}
