import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import { useApiClient } from "@/lib/api-context"
import { useTrackPageView } from "@/lib/analytics"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { workspaceDetailQuery, tasksListQuery } from "@/lib/queries"
import {
	useCreateTask,
	useRotateTokens,
	useSyncWorkflows,
} from "@/lib/mutations"
import { DispatchForm, type ContextItem } from "@/components/dispatch-form"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge"
import { TaskStatusBadge } from "@/components/task-status-badge"
import { WorkspaceSecretsCard } from "@/components/workspace-secrets-card"
import { WorkspaceMcpCard } from "@/components/workspace-mcp-card"
import { WorkspaceSkillsCard } from "@/components/workspace-skills-card"
import { ExternalLinkIcon, KeyRoundIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

const statusFilters = [
	{ value: "all", label: "All" },
	{ value: "working", label: "Working" },
	{ value: "completed", label: "Completed" },
	{ value: "failed", label: "Failed" },
	{ value: "archived", label: "Archived" },
] as const

type StatusFilterValue = (typeof statusFilters)[number]["value"]

function isStatusFilterValue(value: string): value is StatusFilterValue {
	return statusFilters.some(filter => filter.value === value)
}

export function WorkspaceDetailPage() {
	const { workspaceId } = useParams({ strict: false }) as {
		workspaceId: string
	}
	useTrackPageView("workspace_detail", { workspaceId })
	const client = useApiClient()
	const navigate = useNavigate()
	const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all")
	const [prompt, setPrompt] = useState("")
	const [contextItems, setContextItems] = useState<ContextItem[]>([])

	const { data: workspace, isLoading: wsLoading } = useQuery(
		workspaceDetailQuery(client, workspaceId),
	)
	const { data: tasksData, isLoading: tasksLoading } = useQuery(
		tasksListQuery(
			client,
			workspaceId,
			statusFilter === "all" ? undefined : { status: statusFilter },
		),
	)
	const syncWorkflows = useSyncWorkflows(workspaceId)
	const rotateTokens = useRotateTokens(workspaceId)
	const createTask = useCreateTask(workspaceId)
	useDocumentTitle(workspace?.name)

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
	}

	function handleSubmit(promptText: string) {
		const runRefs = contextItems.filter(i => i.source === "flamecast_run")
		const prefix = runRefs
			.map(r => `reference run ${r.source_id} for more details`)
			.join("\n")
		const finalPrompt = prefix ? `${prefix}\n\n${promptText}` : promptText
		createTask.mutate(
			{
				prompt: finalPrompt,
				context: contextItems.length > 0 ? contextItems : undefined,
			},
			{
				onSuccess: data => {
					setPrompt("")
					setContextItems([])
					const taskId = (data as { id: string }).id
					if (taskId) {
						navigate({
							to: "/workspaces/$workspaceId/tasks/$taskId",
							params: { workspaceId, taskId },
						})
					}
				},
			},
		)
	}

	function handleRotateTokens() {
		rotateTokens.mutate(undefined, {
			onSuccess: data => {
				const result = data as {
					smitheryApiKey?: boolean
					flamecastApiKey?: boolean
				}
				if (result.smitheryApiKey && result.flamecastApiKey) {
					toast.success("Rotated SMITHERY_API_KEY and FLAMECAST_API_KEY.")
					return
				}

				const missing: string[] = []
				if (!result.smitheryApiKey) missing.push("SMITHERY_API_KEY")
				if (!result.flamecastApiKey) missing.push("FLAMECAST_API_KEY")
				toast.error(`Failed to rotate: ${missing.join(", ")}`)
			},
			onError: () => {
				toast.error("Failed to rotate workspace tokens.")
			},
		})
	}

	if (wsLoading) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-48 w-full" />
			</div>
		)
	}

	if (!workspace) return null

	const tasks = tasksData?.tasks ?? []
	const needsSecrets =
		!workspace.secretNames?.includes("CLAUDE_CODE_OAUTH_TOKEN") ||
		!workspace.secretNames?.includes("FLAMECAST_PAT")

	const secretsCard = (
		<WorkspaceSecretsCard
			workspaceId={workspaceId}
			workspaceName={workspace.name}
			githubRepo={workspace.githubRepo}
			secretNames={workspace.secretNames}
			isRotating={rotateTokens.isPending}
		/>
	)

	const tasksCard = (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>Tasks</CardTitle>
						<CardDescription>
							Tasks dispatched to this workspace.
						</CardDescription>
					</div>
					<ToggleGroup
						type="single"
						value={statusFilter}
						onValueChange={v => {
							if (v && isStatusFilterValue(v)) setStatusFilter(v)
						}}
						size="sm"
					>
						{statusFilters.map(f => (
							<ToggleGroupItem key={f.value} value={f.value}>
								{f.label}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>
			</CardHeader>
			<CardContent>
				{tasksLoading ? (
					<div className="space-y-2">
						{[1, 2, 3].map(i => (
							<Skeleton key={i} className="h-12 w-full" />
						))}
					</div>
				) : tasks.length === 0 ? (
					<p className="py-8 text-center text-sm text-muted-foreground">
						No tasks yet. Submit a prompt above to create one.
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Prompt</TableHead>
								<TableHead className="w-32">Status</TableHead>
								<TableHead className="w-40">Created</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{tasks.map(task => (
								<TableRow key={task.id}>
									<TableCell>
										<Link
											to="/workspaces/$workspaceId/tasks/$taskId"
											params={{
												workspaceId,
												taskId: task.id,
											}}
											className="hover:underline"
										>
											{task.prompt.length > 80
												? `${task.prompt.slice(0, 80)}...`
												: task.prompt}
										</Link>
									</TableCell>
									<TableCell>
										<TaskStatusBadge
											status={
												task.status as
													| "submitted"
													| "working"
													| "input_required"
													| "completed"
													| "failed"
													| "cancelled"
													| "archived"
											}
										/>
									</TableCell>
									<TableCell className="text-muted-foreground">
										{formatDistanceToNow(new Date(task.createdAt), {
											addSuffix: true,
										})}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	)

	return (
		<div className="space-y-6">
			<div className="flex items-start justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-bold tracking-tight">
							{workspace.name}
						</h1>
						<WorkspaceStatusBadge
							status={workspace.status as "ready" | "provisioning" | "error"}
						/>
					</div>
					<a
						href={`https://github.com/${workspace.githubRepo}`}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
					>
						{workspace.githubRepo}
						<ExternalLinkIcon className="size-3" />
					</a>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => syncWorkflows.mutate()}
						disabled={syncWorkflows.isPending}
					>
						<RefreshCwIcon className="size-4" />
						{syncWorkflows.isPending ? "Syncing..." : "Sync Workflows"}
					</Button>
					<Button
						variant="outline"
						onClick={handleRotateTokens}
						disabled={rotateTokens.isPending}
					>
						<KeyRoundIcon
							className={`size-4 ${rotateTokens.isPending ? "animate-spin" : ""}`}
						/>
						{rotateTokens.isPending ? "Rotating..." : "Rotate Tokens"}
					</Button>
				</div>
			</div>

			<Separator />

			{needsSecrets ? (
				secretsCard
			) : (
				<>
					<DispatchForm
						workspaceId={workspaceId}
						workspaceName={null}
						prompt={prompt}
						setPrompt={setPrompt}
						onSubmit={handleSubmit}
						isSubmitting={createTask.isPending}
						submitError={createTask.isError}
						isAuthenticated
						contextItems={contextItems}
						onAddContext={handleAddContext}
						onRemoveContext={handleRemoveContext}
					/>
					{tasksCard}
					{secretsCard}
				</>
			)}

			<WorkspaceMcpCard workspaceId={workspaceId} />
			<WorkspaceSkillsCard workspaceId={workspaceId} />
		</div>
	)
}
