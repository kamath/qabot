import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { Link } from "@tanstack/react-router"
import { useApiClientOrNull } from "@/lib/api-context"
import { useAuth } from "@/lib/auth-context"
import { useTrackEvent, AnalyticsEvents } from "@/lib/analytics"
import { tasksListQuery } from "@/lib/queries"
import { client } from "@/lib/rpc"
import {
	ContextPill,
	contextKey,
	type ContextItem,
} from "@/components/context-pill"
import { useIsMobile } from "@/hooks/use-mobile"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FlameSpinner } from "@/components/ui/flame-spinner"
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import {
	SendIcon,
	CheckIcon,
	XIcon,
	LoaderIcon,
	ArrowLeftIcon,
	FolderGit2Icon,
	GitPullRequestIcon,
	HistoryIcon,
	PlusIcon,
} from "lucide-react"

export type { ContextItem } from "@/components/context-pill"

type ContextSourceKind = "repo" | "pull_request" | "task"

type GitHubSearchResult = {
	value: string
	label: string
	title?: string
	status?: string
	checksState?: "success" | "failure" | "pending" | "none"
}

type RecentTaskSuggestion = {
	id: string
	prompt: string
	status: string
	createdAt: string
}

function formatPullRequestMeta(item: GitHubSearchResult) {
	if (!item.status) return item.label
	return `${item.status} • ${item.label}`
}

function formatTaskMeta(item: RecentTaskSuggestion) {
	const status = item.status.replace(/_/g, " ")
	const createdAt = new Date(item.createdAt)
	if (Number.isNaN(createdAt.valueOf())) return status
	return `${status} • ${formatDistanceToNow(createdAt, { addSuffix: true })}`
}

function PullRequestChecksIndicator({
	checksState,
}: {
	checksState?: GitHubSearchResult["checksState"]
}) {
	if (checksState === "success") {
		return <CheckIcon className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
	}
	if (checksState === "failure") {
		return <XIcon className="size-3.5 text-destructive shrink-0 mt-0.5" />
	}
	if (checksState === "pending") {
		return (
			<LoaderIcon className="size-3.5 text-amber-500 shrink-0 mt-0.5 animate-spin" />
		)
	}
	return <span className="size-3.5 shrink-0 mt-0.5" />
}

type SuggestionsProps = {
	suggestedRepos: string[]
	recentTasks: RecentTaskSuggestion[]
	contextItems: ContextItem[]
	isLoadingRecentTasks?: boolean
	onAddContext: (item: ContextItem) => void
	enableGithubReferences?: boolean
	enableTaskReferences?: boolean
	onReferenceSelected?: () => void
	className?: string
}

export function Suggestions(props: SuggestionsProps) {
	const {
		className,
		suggestedRepos,
		recentTasks,
		contextItems,
		isLoadingRecentTasks = false,
		onAddContext,
		enableGithubReferences = true,
		enableTaskReferences = false,
		onReferenceSelected,
	} = props
	const [pages, setPages] = useState<ContextSourceKind[]>([])
	const activeKind = pages[pages.length - 1]
	const [query, setQuery] = useState("")
	const [searchResults, setSearchResults] = useState<GitHubSearchResult[]>([])
	const [isSearching, setIsSearching] = useState(false)
	const [recentPullRequests, setRecentPullRequests] = useState<
		GitHubSearchResult[]
	>([])
	const [isLoadingRecentPullRequests, setIsLoadingRecentPullRequests] =
		useState(false)
	const hasLoadedRecentPullRequestsRef = useRef(false)

	const contextKeys = new Set(contextItems.map(contextKey))

	const loadRecentPullRequests = useCallback(async () => {
		if (hasLoadedRecentPullRequestsRef.current || isLoadingRecentPullRequests) {
			return
		}
		setIsLoadingRecentPullRequests(true)
		try {
			const res = await client.github.search.$get({
				query: { q: "", kind: "pull_request" },
			})
			if (!res.ok) return
			const data = (await res.json()) as {
				items?: GitHubSearchResult[]
			}
			setRecentPullRequests(data.items ?? [])
			hasLoadedRecentPullRequestsRef.current = true
		} finally {
			setIsLoadingRecentPullRequests(false)
		}
	}, [isLoadingRecentPullRequests])

	useEffect(() => {
		if (activeKind === "pull_request") {
			void loadRecentPullRequests()
		}
	}, [activeKind, loadRecentPullRequests])

	const availableRepoSuggestions = suggestedRepos.filter(
		repo => !contextKeys.has(`github_repo:${repo}`),
	)

	const availableRecentPullRequests = recentPullRequests.filter(
		pr => !contextKeys.has(`github_pr:${pr.value}`),
	)

	const availableRecentTasks = recentTasks.filter(
		task => !contextKeys.has(`flamecast_run:${task.id}`),
	)

	const filteredSearchResults = searchResults.filter(item => {
		const source = activeKind === "pull_request" ? "github_pr" : "github_repo"
		return !contextKeys.has(`${source}:${item.value}`)
	})

	const filteredRecentTasks =
		query.trim().length === 0
			? availableRecentTasks
			: availableRecentTasks.filter(task => {
					const normalizedPrompt = task.prompt.toLowerCase()
					const normalizedId = task.id.toLowerCase()
					const normalizedQuery = query.trim().toLowerCase()
					return (
						normalizedPrompt.includes(normalizedQuery) ||
						normalizedId.includes(normalizedQuery)
					)
				})

	const pushPage = useCallback((kind: ContextSourceKind) => {
		setPages(prev => [...prev, kind])
		setQuery("")
		setSearchResults([])
	}, [])

	const popPage = useCallback(() => {
		setPages(prev => prev.slice(0, -1))
		setQuery("")
		setSearchResults([])
	}, [])

	useEffect(() => {
		if (!activeKind || activeKind === "task" || !query.trim()) {
			setSearchResults([])
			setIsSearching(false)
			return
		}

		let cancelled = false
		const timer = setTimeout(async () => {
			setIsSearching(true)
			try {
				const res = await client.github.search.$get({
					query: { q: query.trim(), kind: activeKind },
				})
				if (!res.ok || cancelled) return
				const data = (await res.json()) as { items?: GitHubSearchResult[] }
				if (!cancelled) setSearchResults(data.items ?? [])
			} finally {
				if (!cancelled) setIsSearching(false)
			}
		}, 300)

		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [activeKind, query])

	const onCommandKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			if (
				(e.key === "Escape" || e.key === "Backspace") &&
				query.length === 0 &&
				activeKind
			) {
				e.preventDefault()
				popPage()
			}
		},
		[activeKind, popPage, query.length],
	)

	function handleSelectGithubReference(reference: string) {
		const prMatch = reference.match(
			/^https?:\/\/github\.com\/[^/]+\/[^/]+\/pull\/[0-9]+/i,
		)
		onAddContext({
			source: prMatch ? "github_pr" : "github_repo",
			source_id: reference,
		})
		onReferenceSelected?.()
		setQuery("")
		setSearchResults([])
	}

	const isRepoPage = activeKind === "repo"
	const isPullRequestPage = activeKind === "pull_request"
	const isTaskPage = activeKind === "task"
	const placeholder = !activeKind
		? "Search categories..."
		: isPullRequestPage
			? "Search pull requests..."
			: isTaskPage
				? "Search recent tasks..."
				: "Search repositories..."
	const emptyText = !activeKind
		? "No matching category."
		: "No matching results."

	return (
		<Command
			onKeyDown={onCommandKeyDown}
			className={cn("h-full rounded-xl border bg-background", className)}
		>
			<CommandInput
				value={query}
				onValueChange={setQuery}
				placeholder={placeholder}
				aria-label="Search references"
			/>
			<CommandList className="flex-1 max-h-72">
				{!activeKind && <CommandEmpty>{emptyText}</CommandEmpty>}

				{!activeKind ? (
					<CommandGroup heading="Reference Sources">
						{enableGithubReferences && (
							<>
								<CommandItem
									value="github repositories repos"
									onSelect={() => pushPage("repo")}
								>
									<FolderGit2Icon />
									GitHub Repos
								</CommandItem>
								<CommandItem
									value="github pull requests prs"
									onSelect={() => pushPage("pull_request")}
								>
									<GitPullRequestIcon />
									Pull Requests
								</CommandItem>
							</>
						)}
						{enableTaskReferences && (
							<CommandItem
								value="recent tasks workflow runs"
								onSelect={() => pushPage("task")}
							>
								<HistoryIcon />
								Recent Tasks
							</CommandItem>
						)}
					</CommandGroup>
				) : (
					<>
						<CommandGroup>
							<CommandItem value="go back" onSelect={popPage}>
								<ArrowLeftIcon />
								Back
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />

						{isRepoPage && (
							<CommandGroup heading="Suggested Repositories">
								{availableRepoSuggestions.map(repo => (
									<CommandItem
										key={repo}
										value={`${repo} github repository`}
										onSelect={() => handleSelectGithubReference(repo)}
									>
										<img
											src="https://github.com/favicon.ico"
											className="size-3 rounded-sm shrink-0"
											alt=""
										/>
										<span className="truncate">{repo}</span>
									</CommandItem>
								))}
							</CommandGroup>
						)}

						{isPullRequestPage && (
							<CommandGroup heading="Recent Pull Requests" forceMount>
								{isLoadingRecentPullRequests && (
									<CommandItem
										disabled
										forceMount
										value="loading-recent-prs"
										className="text-xs text-muted-foreground"
									>
										<LoaderIcon className="size-3 animate-spin" />
										Loading recent PRs...
									</CommandItem>
								)}
								{!isLoadingRecentPullRequests &&
									availableRecentPullRequests.map(pr => (
										<CommandItem
											key={pr.value}
											value={`${pr.title ?? pr.label} ${formatPullRequestMeta(pr)} ${pr.value}`}
											onSelect={() => handleSelectGithubReference(pr.value)}
										>
											<div className="min-w-0">
												<p className="truncate text-[13px] leading-5 font-medium">
													{pr.title ?? pr.label}
												</p>
												<p className="truncate text-[11px] text-muted-foreground">
													{formatPullRequestMeta(pr)}
												</p>
											</div>
											<PullRequestChecksIndicator
												checksState={pr.checksState}
											/>
										</CommandItem>
									))}
							</CommandGroup>
						)}

						{isTaskPage && (
							<CommandGroup heading="Recent Tasks" forceMount>
								{isLoadingRecentTasks && (
									<CommandItem
										disabled
										forceMount
										value="loading-recent-tasks"
										className="text-xs text-muted-foreground"
									>
										<LoaderIcon className="size-3 animate-spin" />
										Loading recent tasks...
									</CommandItem>
								)}
								{!isLoadingRecentTasks && filteredRecentTasks.length === 0 && (
									<CommandItem
										disabled
										forceMount
										value="no-recent-tasks"
										className="text-xs text-muted-foreground"
									>
										No matching tasks.
									</CommandItem>
								)}
								{!isLoadingRecentTasks &&
									filteredRecentTasks.map(task => (
										<CommandItem
											key={task.id}
											value={`${task.prompt} ${task.id} ${formatTaskMeta(task)}`}
											onSelect={() => {
												onAddContext({
													source: "flamecast_run",
													source_id: task.id,
												})
												onReferenceSelected?.()
											}}
										>
											<div className="min-w-0">
												<p className="truncate text-[13px] leading-5 font-medium">
													{task.prompt}
												</p>
												<p className="truncate text-[11px] text-muted-foreground">
													Run {task.id} • {formatTaskMeta(task)}
												</p>
											</div>
										</CommandItem>
									))}
							</CommandGroup>
						)}

						{!isTaskPage && query.trim().length > 0 && (
							<>
								<CommandSeparator />
								<CommandGroup heading="Search Results" forceMount>
									{isSearching && (
										<CommandItem
											disabled
											forceMount
											value="loading-search-results"
											className="text-xs text-muted-foreground"
										>
											<LoaderIcon className="size-3 animate-spin" />
											Search results are loading...
										</CommandItem>
									)}
									{!isSearching && filteredSearchResults.length === 0 && (
										<CommandItem
											disabled
											forceMount
											value="no-search-results"
											className="text-xs text-muted-foreground"
										>
											No matching results.
										</CommandItem>
									)}
									{!isSearching &&
										filteredSearchResults.length > 0 &&
										filteredSearchResults.map(item => (
											<CommandItem
												key={item.value}
												value={`${item.title ?? item.label} ${item.label} ${item.value}`}
												onSelect={() => handleSelectGithubReference(item.value)}
											>
												<img
													src="https://github.com/favicon.ico"
													className="size-3 rounded-sm shrink-0"
													alt=""
												/>
												{isPullRequestPage ? (
													<div className="min-w-0">
														<div className="truncate">
															{item.title ?? item.label}
														</div>
														<div className="truncate text-[11px] text-muted-foreground">
															{formatPullRequestMeta(item)}
														</div>
													</div>
												) : (
													<span className="truncate">{item.label}</span>
												)}
											</CommandItem>
										))}
								</CommandGroup>
							</>
						)}
					</>
				)}
			</CommandList>
		</Command>
	)
}

export function DispatchForm({
	workspaceId,
	workspaceName,
	prompt,
	setPrompt,
	onSubmit,
	isSubmitting,
	submitError,
	isAuthenticated,
	isAuthLoading = false,
	contextItems = [],
	onAddContext,
	onRemoveContext,
	suggestedRepos = [],
}: {
	workspaceId: string | null
	workspaceName: string | null
	prompt: string
	setPrompt: (value: string) => void
	onSubmit: (prompt: string) => void
	isSubmitting: boolean
	submitError: boolean
	isAuthenticated: boolean
	isAuthLoading?: boolean
	contextItems?: ContextItem[]
	onAddContext?: (item: ContextItem) => void
	onRemoveContext?: (item: ContextItem) => void
	suggestedRepos?: string[]
}) {
	const apiClient = useApiClientOrNull()
	const { signIn } = useAuth()
	const trackEvent = useTrackEvent()
	const isMobile = useIsMobile()
	const [isContextDialogOpen, setIsContextDialogOpen] = useState(false)
	const canManageContext = typeof onAddContext === "function"

	const { data: recentTasksData, isLoading: isLoadingRecentTasks } = useQuery({
		...tasksListQuery(apiClient!, workspaceId ?? ""),
		enabled: !!apiClient && !!workspaceId && canManageContext,
	})
	const recentTasks: RecentTaskSuggestion[] = (
		recentTasksData?.tasks ?? []
	).map(task => ({
		id: task.id,
		prompt: task.prompt,
		status: task.status,
		createdAt: task.createdAt,
	}))

	const canSubmit =
		isAuthenticated && !!workspaceId && !!prompt.trim() && !isSubmitting

	const openContextDialog = useCallback(() => {
		if (!canManageContext) return
		setIsContextDialogOpen(true)
	}, [canManageContext])

	useEffect(() => {
		if (!canManageContext) return

		function handleGlobalKeyDown(event: KeyboardEvent) {
			if (event.defaultPrevented || event.isComposing || event.repeat) return

			const isOpenShortcut =
				(event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k"
			if (!isOpenShortcut) return

			event.preventDefault()
			setIsContextDialogOpen(true)
		}

		window.addEventListener("keydown", handleGlobalKeyDown)
		return () => window.removeEventListener("keydown", handleGlobalKeyDown)
	}, [canManageContext])

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!canSubmit) return
		trackEvent(AnalyticsEvents.TASK_DISPATCHED, {
			workspaceId,
			promptLength: prompt.trim().length,
		})
		onSubmit(prompt.trim())
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			handleSubmit(e)
		}
	}

	return (
		<form onSubmit={handleSubmit} className="w-full max-w-2xl">
			{(contextItems.length > 0 || canManageContext) && (
				<div className="flex flex-wrap items-center content-start gap-1.5 mb-2 max-h-24 overflow-y-auto pr-1">
					{contextItems.map(item => (
						<ContextPill
							key={contextKey(item)}
							item={item}
							onRemove={onRemoveContext}
						/>
					))}
					{canManageContext && (
						<button
							type="button"
							onClick={openContextDialog}
							className="inline-flex h-5 items-center gap-1.5 rounded-full border px-2.5 text-xs hover:bg-muted transition-colors"
							aria-label="Add context"
						>
							<PlusIcon className="size-3" />
							Add context
							{!isMobile && (
								<span className="text-[10px] text-muted-foreground">Cmd+K</span>
							)}
						</button>
					)}
				</div>
			)}
			<div className="relative">
				<Textarea
					autoFocus
					placeholder="What would you like your agent to do?"
					value={prompt}
					onChange={e => setPrompt(e.target.value)}
					onKeyDown={handleKeyDown}
					rows={3}
					disabled={isSubmitting}
					className="resize-none pr-14 text-base rounded-2xl border-2 focus:border-primary"
				/>
				<Button
					type="submit"
					size="icon"
					disabled={!canSubmit}
					className="absolute right-3 bottom-3 rounded-full"
				>
					{isSubmitting ? (
						<FlameSpinner className="size-4" />
					) : (
						<SendIcon className="size-4" />
					)}
				</Button>
			</div>
			{canManageContext && (
				<CommandDialog
					open={isContextDialogOpen}
					onOpenChange={setIsContextDialogOpen}
					title="Add Context"
					description="Search repositories, pull requests, and recent tasks to add as context."
					className="max-w-2xl"
				>
					<Suggestions
						suggestedRepos={suggestedRepos}
						recentTasks={recentTasks}
						contextItems={contextItems}
						isLoadingRecentTasks={isLoadingRecentTasks}
						onAddContext={onAddContext!}
						enableGithubReferences
						enableTaskReferences
						onReferenceSelected={() => setIsContextDialogOpen(false)}
						className="h-auto"
					/>
				</CommandDialog>
			)}
			{submitError && (
				<p className="text-sm text-destructive mt-2 text-center">
					Failed to dispatch task. Please try again.
				</p>
			)}
			{!isAuthLoading && !isAuthenticated ? (
				<div className="mt-2 flex justify-center">
					<Button
						variant="outline"
						size="sm"
						type="button"
						onClick={() => signIn()}
					>
						Sign in to dispatch
					</Button>
				</div>
			) : (
				workspaceName !== null &&
				(workspaceName ? (
					<p className="text-xs text-muted-foreground mt-2 text-center">
						Dispatching to{" "}
						<Link
							to="/workspaces/$workspaceId"
							params={{ workspaceId: workspaceId! }}
							className="underline hover:text-foreground"
						>
							{workspaceName}
						</Link>
					</p>
				) : (
					<div className="mt-2 flex justify-center">
						<Skeleton className="h-4 w-40" />
					</div>
				))
			)}
		</form>
	)
}
