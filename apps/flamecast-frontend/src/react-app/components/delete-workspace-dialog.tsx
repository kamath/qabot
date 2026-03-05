import { useDeleteWorkspace } from "@/lib/mutations"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { TrashIcon } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"

export function DeleteWorkspaceDialog({
	workspaceId,
	workspaceName,
	onDeleted,
}: {
	workspaceId: string
	workspaceName: string
	onDeleted?: () => void
}) {
	const deleteWorkspace = useDeleteWorkspace()

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="ghost" size="icon">
					<TrashIcon className="size-4" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Workspace</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently delete "{workspaceName}" and its associated
						GitHub repository. This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={deleteWorkspace.isPending}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						disabled={deleteWorkspace.isPending}
						onClick={e => {
							e.preventDefault()
							deleteWorkspace.mutate(workspaceId, {
								onSuccess: data => {
									if (data.repoDeleted === false) {
										toast.warning(
											"Workspace deleted, but the GitHub repository could not be removed. You may need to delete it manually.",
										)
									} else {
										toast.success(`Workspace "${workspaceName}" deleted.`)
									}
									onDeleted?.()
								},
								onError: () => {
									toast.error(
										`Failed to delete workspace "${workspaceName}". Please try again.`,
									)
								},
							})
						}}
					>
						{deleteWorkspace.isPending ? (
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
	)
}
