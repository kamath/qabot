import { useState } from "react"
import { useCreateWorkspace } from "@/lib/mutations"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { PlusIcon } from "lucide-react"

export function CreateWorkspaceDialog() {
	const [open, setOpen] = useState(false)
	const [name, setName] = useState("")
	const [systemPrompt, setSystemPrompt] = useState("")
	const createWorkspace = useCreateWorkspace()

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		createWorkspace.mutate(
			{
				name,
				systemPrompt: systemPrompt || undefined,
			},
			{
				onSuccess: () => {
					setOpen(false)
					setName("")
					setSystemPrompt("")
				},
			},
		)
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<PlusIcon />
					New Workspace
				</Button>
			</DialogTrigger>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Create Workspace</DialogTitle>
						<DialogDescription>
							Create a new workspace with its own GitHub repository.
						</DialogDescription>
					</DialogHeader>
					<div className="mt-4 space-y-4">
						<div className="space-y-2">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								placeholder="my-workspace"
								value={name}
								onChange={e => setName(e.target.value)}
								required
							/>
							<p className="text-xs text-muted-foreground">
								Lowercase letters, numbers, and hyphens only.
							</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor="systemPrompt">System Prompt (optional)</Label>
							<Textarea
								id="systemPrompt"
								placeholder="Instructions for the agent..."
								value={systemPrompt}
								onChange={e => setSystemPrompt(e.target.value)}
								rows={3}
							/>
						</div>
					</div>
					<DialogFooter className="mt-6">
						<Button type="submit" disabled={!name || createWorkspace.isPending}>
							{createWorkspace.isPending ? "Creating..." : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
