import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useApiClient } from "@/lib/api-context"
import { useTrackPageView } from "@/lib/analytics"
import { apiKeysListQuery } from "@/lib/queries"
import { useCreateApiKey, useDeleteApiKey } from "@/lib/mutations"
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
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
	EmptyDescription,
} from "@/components/ui/empty"
import {
	KeyRoundIcon,
	PlusIcon,
	TrashIcon,
	CopyIcon,
	CheckIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"

export function ApiKeysPage() {
	useDocumentTitle("API Keys")
	useTrackPageView("api_keys")
	const client = useApiClient()
	const { data, isLoading } = useQuery(apiKeysListQuery(client))
	const createApiKey = useCreateApiKey()
	const deleteApiKey = useDeleteApiKey()

	const [showCreateDialog, setShowCreateDialog] = useState(false)
	const [keyName, setKeyName] = useState("")
	const [createdKey, setCreatedKey] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null)

	function handleCreate(e: React.FormEvent) {
		e.preventDefault()
		createApiKey.mutate(
			{ name: keyName || undefined },
			{
				onSuccess: data => {
					setCreatedKey(data.key)
					setShowCreateDialog(false)
					setKeyName("")
					toast.success("API key created.")
				},
				onError: () => {
					toast.error("Failed to create API key.")
				},
			},
		)
	}

	function handleDelete() {
		if (!deletingKeyId) return
		deleteApiKey.mutate(deletingKeyId, {
			onSuccess: () => {
				setDeletingKeyId(null)
				toast.success("API key deleted.")
			},
			onError: () => {
				toast.error("Failed to delete API key.")
			},
		})
	}

	async function copyKey() {
		if (!createdKey) return
		await navigator.clipboard.writeText(createdKey)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	if (isLoading) {
		return (
			<div className="mx-auto max-w-2xl space-y-4">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-64 w-full" />
			</div>
		)
	}

	const keys = data?.keys ?? []
	const deletingKey = keys.find(k => k.id === deletingKeyId)

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
					<p className="text-muted-foreground">
						Manage API keys for programmatic access to Flamecast.
					</p>
				</div>
				<Button onClick={() => setShowCreateDialog(true)}>
					<PlusIcon className="size-4" />
					Create Key
				</Button>
			</div>

			{keys.length === 0 ? (
				<Card>
					<CardContent className="py-12">
						<Empty>
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<KeyRoundIcon />
								</EmptyMedia>
								<EmptyTitle>No API keys</EmptyTitle>
								<EmptyDescription>
									Create an API key to get started with the Flamecast API.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>Your Keys</CardTitle>
						<CardDescription>
							{keys.length} key{keys.length !== 1 && "s"}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Key</TableHead>
									<TableHead>Created</TableHead>
									<TableHead>Last Used</TableHead>
									<TableHead className="w-10" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{keys.map(key => (
									<TableRow key={key.id}>
										<TableCell className="font-medium">{key.name}</TableCell>
										<TableCell className="font-mono text-muted-foreground">
											{key.obfuscatedValue}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{new Date(key.createdAt).toLocaleDateString()}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{key.lastUsedAt
												? new Date(key.lastUsedAt).toLocaleDateString()
												: "Never"}
										</TableCell>
										<TableCell>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setDeletingKeyId(key.id)}
											>
												<TrashIcon className="size-4" />
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			{/* Create API Key Dialog */}
			<Dialog
				open={showCreateDialog}
				onOpenChange={open => {
					if (!open) {
						setShowCreateDialog(false)
						setKeyName("")
						createApiKey.reset()
					}
				}}
			>
				<DialogContent>
					<form onSubmit={handleCreate}>
						<DialogHeader>
							<DialogTitle>Create API Key</DialogTitle>
							<DialogDescription>
								Give your key a name to help you identify it later.
							</DialogDescription>
						</DialogHeader>
						<div className="mt-4 space-y-4">
							<div className="space-y-2">
								<Label htmlFor="key-name">Name</Label>
								<Input
									id="key-name"
									placeholder="e.g. Production, CI/CD"
									value={keyName}
									onChange={e => setKeyName(e.target.value)}
								/>
							</div>
						</div>
						<DialogFooter className="mt-6">
							<Button type="submit" disabled={createApiKey.isPending}>
								{createApiKey.isPending ? (
									<>
										<Spinner />
										Creating…
									</>
								) : (
									"Create"
								)}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Show Created Key Dialog */}
			<Dialog
				open={!!createdKey}
				onOpenChange={open => {
					if (!open) {
						setCreatedKey(null)
						setCopied(false)
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>API Key Created</DialogTitle>
						<DialogDescription>
							Copy your key now. You won't be able to see it again.
						</DialogDescription>
					</DialogHeader>
					<div className="mt-4">
						<div className="flex items-center gap-2">
							<code className="flex-1 rounded-md bg-muted px-4 py-3 text-sm font-mono break-all">
								{createdKey}
							</code>
							<Button variant="outline" size="icon" onClick={copyKey}>
								{copied ? (
									<CheckIcon className="size-4" />
								) : (
									<CopyIcon className="size-4" />
								)}
							</Button>
						</div>
					</div>
					<DialogFooter className="mt-6">
						<Button
							onClick={() => {
								setCreatedKey(null)
								setCopied(false)
							}}
						>
							Done
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation */}
			<AlertDialog
				open={!!deletingKeyId}
				onOpenChange={open => {
					if (!open) setDeletingKeyId(null)
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete API Key</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently revoke{" "}
							{deletingKey ? `"${deletingKey.name}"` : "this key"}. Any
							applications using it will lose access.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteApiKey.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={deleteApiKey.isPending}
							onClick={e => {
								e.preventDefault()
								handleDelete()
							}}
						>
							{deleteApiKey.isPending ? (
								<>
									<Spinner />
									Deleting…
								</>
							) : (
								"Delete"
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
