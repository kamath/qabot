import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { formatDistanceToNow } from "date-fns"
import { useApiClient } from "@/lib/api-context"
import { workspacesListQuery, defaultWorkspaceQuery } from "@/lib/queries"
import { useSetDefaultWorkspace } from "@/lib/mutations"
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { WorkspaceStatusBadge } from "@/components/workspace-status-badge"
import { DeleteWorkspaceDialog } from "@/components/delete-workspace-dialog"
import {
	ExternalLinkIcon,
	MoreVerticalIcon,
	PlusIcon,
	StarIcon,
} from "lucide-react"

function WorkspaceOnboarding() {
	return (
		<Empty className="w-full flex flex-col items-center justify-center gap-8">
			<EmptyTitle className="text-6xl">Cast your first Flame!</EmptyTitle>
			<EmptyDescription className="max-w-lg text-md">
				Flames are git-backed workspaces for AI agents. Each workspace is a
				GitHub repository with its own skills, context, and memory.
			</EmptyDescription>
			<Link to="/workspaces/new" search={{}}>
				<Button size="lg">
					<PlusIcon />
					New Workspace
				</Button>
			</Link>
		</Empty>
	)
}

export function WorkspacesListPage() {
	useDocumentTitle("Workspaces")
	const client = useApiClient()
	const { data, isLoading } = useQuery(workspacesListQuery(client))
	const { data: defaultData } = useQuery(defaultWorkspaceQuery(client))
	const setDefault = useSetDefaultWorkspace()
	const [showOnboarding, setShowOnboarding] = useState(false)

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-10 w-36" />
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{[1, 2, 3].map(i => (
						<Skeleton key={i} className="h-48" />
					))}
				</div>
			</div>
		)
	}

	const defaultWorkspaceId = defaultData?.defaultWorkspaceId
	const workspaces = [...(data?.workspaces ?? [])].sort((a, b) => {
		if (a.id === defaultWorkspaceId) return -1
		if (b.id === defaultWorkspaceId) return 1
		return 0
	})

	if (workspaces.length === 0 || showOnboarding) {
		return (
			<div className="space-y-6 min-h-full flex flex-col w-full">
				<WorkspaceOnboarding />
				{import.meta.env.DEV && showOnboarding && (
					<Button
						variant="ghost"
						size="sm"
						className="self-center text-muted-foreground"
						onClick={() => setShowOnboarding(false)}
					>
						Exit NUX preview
					</Button>
				)}
			</div>
		)
	}

	return (
		<div className="space-y-6 min-h-full flex flex-col">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
					<p className="text-muted-foreground">Manage your agent workspaces.</p>
				</div>
				<div className="flex items-center gap-2">
					{import.meta.env.DEV && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowOnboarding(true)}
						>
							Preview NUX
						</Button>
					)}
					<Link to="/workspaces/new" search={{}}>
						<Button>
							<PlusIcon />
							New Workspace
						</Button>
					</Link>
				</div>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{workspaces.map(ws => (
					<Link
						key={ws.id}
						to="/workspaces/$workspaceId"
						params={{ workspaceId: ws.id }}
						className="block"
					>
						<Card className="transition-colors hover:border-foreground/20">
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="space-y-1">
										<CardTitle className="flex items-center gap-2">
											{ws.name}
											{ws.id === defaultWorkspaceId && (
												<StarIcon className="size-4 fill-current text-primary" />
											)}
										</CardTitle>
										<CardDescription>
											{formatDistanceToNow(new Date(ws.createdAt), {
												addSuffix: true,
											})}
										</CardDescription>
									</div>
									{ws.status !== "ready" && (
										<WorkspaceStatusBadge
											status={ws.status as "provisioning" | "error"}
										/>
									)}
								</div>
							</CardHeader>
							<CardContent>
								<span
									onClick={e => {
										e.preventDefault()
										window.open(`https://github.com/${ws.githubRepo}`, "_blank")
									}}
									className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
								>
									{ws.githubRepo}
									<ExternalLinkIcon className="size-3" />
								</span>
							</CardContent>
							<CardFooter className="gap-2" onClick={e => e.preventDefault()}>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon" className="ml-auto">
											<MoreVerticalIcon className="size-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem
											onClick={e => {
												e.stopPropagation()
												setDefault.mutate(ws.id)
											}}
											disabled={ws.id === defaultWorkspaceId}
										>
											<StarIcon className="size-4" />
											Set as Default
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
								<DeleteWorkspaceDialog
									workspaceId={ws.id}
									workspaceName={ws.name}
								/>
							</CardFooter>
						</Card>
					</Link>
				))}
			</div>
		</div>
	)
}
