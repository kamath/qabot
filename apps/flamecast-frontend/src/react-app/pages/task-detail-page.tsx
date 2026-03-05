import { useQuery } from "@tanstack/react-query"
import { useParams, Link } from "@tanstack/react-router"
import { format } from "date-fns"
import { useApiClient } from "@/lib/api-context"
import { useTrackPageView } from "@/lib/analytics"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { taskDetailQuery, workspaceDetailQuery } from "@/lib/queries"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { TaskStatusBadge } from "@/components/task-status-badge"
import {
	ContextPill,
	contextKey,
	type ContextItem,
} from "@/components/context-pill"
import {
	ArrowLeftIcon,
	AlertCircleIcon,
	ExternalLinkIcon,
	CornerDownLeftIcon,
} from "lucide-react"
import { Streamdown } from "streamdown"
import { code } from "@streamdown/code"
import { mermaid } from "@streamdown/mermaid"
import { math } from "@streamdown/math"
import { cjk } from "@streamdown/cjk"
import "katex/dist/katex.min.css"
import "streamdown/styles.css"

export function TaskDetailPage() {
	const { workspaceId, taskId } = useParams({ strict: false }) as {
		workspaceId: string
		taskId: string
	}
	useTrackPageView("task_detail", { workspaceId, taskId })
	const client = useApiClient()
	const { data: workspace } = useQuery(
		workspaceDetailQuery(client, workspaceId),
	)
	const { data, isLoading } = useQuery(
		taskDetailQuery(client, workspaceId, taskId),
	)
	useDocumentTitle(data?.task?.prompt)

	if (isLoading) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-48 w-full" />
				<Skeleton className="h-64 w-full" />
			</div>
		)
	}

	if (!data) return null

	const { task, output, payload } = data

	// Read context from response, with fallback to legacy payload fields
	const context: ContextItem[] = (() => {
		const raw = (data as unknown as { context?: ContextItem[] }).context
		if (Array.isArray(raw) && raw.length > 0) return raw as ContextItem[]
		// Fallback: derive from legacy payload fields
		const items: ContextItem[] = []
		if (payload && typeof payload.parent_run_id === "string") {
			items.push({ source: "flamecast_run", source_id: payload.parent_run_id })
		}
		if (payload && Array.isArray(payload.url_references)) {
			for (const ref of payload.url_references) {
				if (typeof ref === "string") {
					const isPr = /\/pull\/[0-9]+/i.test(ref)
					items.push({
						source: isPr ? "github_pr" : "github_repo",
						source_id: ref,
					})
				}
			}
		}
		return items
	})()

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="icon" asChild>
					<Link to="/workspaces/$workspaceId" params={{ workspaceId }}>
						<ArrowLeftIcon className="size-4" />
					</Link>
				</Button>
				<div className="flex-1">
					<h1 className="text-2xl font-bold tracking-tight">Task Detail</h1>
				</div>
				{task.status === "completed" && (
					<Button variant="outline" size="sm" asChild>
						<Link
							to="/"
							search={{
								runId: task.workflowRunId
									? String(task.workflowRunId)
									: task.id,
							}}
						>
							<CornerDownLeftIcon className="size-4 mr-1.5" />
							Follow-up
						</Link>
					</Button>
				)}
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-start justify-between">
						<div className="space-y-1">
							<CardTitle>Status</CardTitle>
							<CardDescription className="max-w-xl">
								{task.prompt}
							</CardDescription>
						</div>
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
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="grid gap-2 text-sm sm:grid-cols-3">
						<div>
							<span className="text-muted-foreground">Created</span>
							<p>{format(new Date(task.createdAt), "PPp")}</p>
						</div>
						{task.startedAt && (
							<div>
								<span className="text-muted-foreground">Started</span>
								<p>{format(new Date(task.startedAt), "PPp")}</p>
							</div>
						)}
						{task.completedAt && (
							<div>
								<span className="text-muted-foreground">Completed</span>
								<p>{format(new Date(task.completedAt), "PPp")}</p>
							</div>
						)}
					</div>
					{context.length > 0 && (
						<div className="space-y-1.5">
							<span className="text-muted-foreground text-sm">Context</span>
							<div className="flex flex-wrap items-center gap-1.5">
								{context.map(item => (
									<ContextPill
										key={contextKey(item)}
										item={item}
										workspaceId={workspaceId}
									/>
								))}
							</div>
						</div>
					)}
					{task.workflowRunId && workspace?.githubRepo && (
						<div className="flex flex-wrap gap-4">
							<a
								href={`https://github.com/${workspace.githubRepo}/actions/runs/${task.workflowRunId}`}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
							>
								GitHub Actions Run
								<ExternalLinkIcon className="size-3" />
							</a>
							<a
								href={`https://github.com/${workspace.githubRepo}/tree/HEAD/runs/${task.workflowRunId}`}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
							>
								Run Artifacts
								<ExternalLinkIcon className="size-3" />
							</a>
						</div>
					)}
				</CardContent>
			</Card>

			{task.status === "failed" && task.errorMessage && (
				<Alert variant="destructive">
					<AlertCircleIcon className="size-4" />
					<AlertTitle>Task Failed</AlertTitle>
					<AlertDescription>{task.errorMessage}</AlertDescription>
				</Alert>
			)}

			{task.status === "input_required" && task.pendingInput && (
				<Card>
					<CardHeader>
						<CardTitle>Input Required</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-sm">{task.pendingInput.question}</p>
						{task.pendingInput.options && (
							<div className="flex flex-wrap gap-2">
								{task.pendingInput.options.map(opt => (
									<Button key={opt} variant="outline" size="sm">
										{opt}
									</Button>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			)}

			<Separator />

			{output && (
				<div className="bg-transparent">
					<Streamdown plugins={{ code, mermaid, math, cjk }}>
						{output}
					</Streamdown>
				</div>
			)}
		</div>
	)
}
