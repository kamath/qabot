import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAddMcpConnection, useRemoveMcpConnection } from "@/lib/mutations"
import { mcpConnectionsQuery } from "@/lib/queries"
import {
	type WorkspaceMcpConnection,
	useSmitheryClient,
} from "@/lib/smithery-mcp"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	ExternalLinkIcon,
	PlusIcon,
	Trash2Icon,
	XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

export function WorkspaceMcpCard({ workspaceId }: { workspaceId: string }) {
	const [dialogOpen, setDialogOpen] = useState(false)
	const [serverInput, setServerInput] = useState("")
	const smithery = useSmitheryClient(workspaceId)
	const { data, isLoading } = useQuery(
		mcpConnectionsQuery(workspaceId, smithery),
	)
	const addMcp = useAddMcpConnection(workspaceId, smithery)
	const removeMcp = useRemoveMcpConnection(workspaceId, smithery)
	const connections = data?.connections ?? []

	function handleAdd(e: React.FormEvent) {
		e.preventDefault()
		if (!serverInput.trim()) return

		addMcp.mutate(
			{ server: serverInput.trim() },
			{
				onSuccess: res => {
					setDialogOpen(false)
					setServerInput("")
					if (
						res.connection.status === "auth_required" &&
						res.connection.authorizationUrl
					) {
						toast.info("Authorization required", {
							action: {
								label: "Authorize",
								onClick: () =>
									window.open(res.connection.authorizationUrl, "_blank"),
							},
						})
					} else {
						toast.success("MCP connection added")
					}
				},
				onError: () => {
					toast.error("Failed to add MCP connection")
				},
			},
		)
	}

	function handleRemove(connection: WorkspaceMcpConnection) {
		if (!connection.connectionId) {
			toast.error("Cannot remove connection: missing connection ID")
			return
		}
		removeMcp.mutate(connection.connectionId, {
			onSuccess: () => toast.success("MCP connection removed"),
			onError: () => toast.error("Failed to remove MCP connection"),
		})
	}

	function closeDialog() {
		setDialogOpen(false)
		setServerInput("")
		addMcp.reset()
	}

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>MCP Connections</CardTitle>
					<CardDescription>
						Connect MCP servers to give your agent access to external tools.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<button
						type="button"
						onClick={() => setDialogOpen(true)}
						className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
					>
						<PlusIcon className="size-4" />
						Add MCP Connection
					</button>

					{isLoading ? (
						<div className="space-y-2">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
						</div>
					) : connections.length > 0 ? (
						<div className="space-y-1">
							{connections.map(conn => (
								<div
									key={conn.connectionId ?? conn.server}
									className="flex items-center justify-between rounded-md px-3 py-2 text-sm"
								>
									<span className="flex items-center gap-2 text-muted-foreground">
										{conn.status === "ready" && (
											<CheckCircle2Icon className="size-3.5 text-green-500" />
										)}
										{conn.status === "auth_required" && (
											<AlertTriangleIcon className="size-3.5 text-amber-500" />
										)}
										{conn.status === "error" && (
											<XCircleIcon className="size-3.5 text-red-500" />
										)}
										{conn.server}
									</span>
									<div className="flex items-center gap-1">
										{conn.status === "auth_required" &&
											conn.authorizationUrl && (
												<a
													href={conn.authorizationUrl}
													target="_blank"
													rel="noopener noreferrer"
												>
													<Button variant="outline" size="sm">
														<ExternalLinkIcon className="mr-1 size-3" />
														Authorize
													</Button>
												</a>
											)}
										<Button
											variant="ghost"
											size="icon"
											className="size-8"
											onClick={() => handleRemove(conn)}
											disabled={removeMcp.isPending || !conn.connectionId}
										>
											<Trash2Icon className="size-3.5" />
										</Button>
									</div>
								</div>
							))}
						</div>
					) : null}
				</CardContent>
			</Card>

			<Dialog open={dialogOpen} onOpenChange={open => !open && closeDialog()}>
				<DialogContent>
					<form onSubmit={handleAdd}>
						<DialogHeader>
							<DialogTitle>Add MCP Connection</DialogTitle>
							<DialogDescription>
								Enter a Smithery registry slug (e.g. "linear") or a full MCP
								server URL.
							</DialogDescription>
						</DialogHeader>
						<div className="mt-4 space-y-4">
							<div className="space-y-2">
								<Label htmlFor="mcp-server">Server</Label>
								<Input
									id="mcp-server"
									placeholder="e.g. linear or https://..."
									value={serverInput}
									onChange={e => setServerInput(e.target.value)}
									required
								/>
							</div>
						</div>
						<DialogFooter className="mt-6">
							<Button
								type="submit"
								disabled={!serverInput.trim() || addMcp.isPending}
							>
								{addMcp.isPending ? "Adding..." : "Add"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	)
}
