import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useCreateWorkspace } from "@/lib/mutations"
import { DEFAULT_TEMPLATE } from "@/lib/flame-templates"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"

export function NewWorkspacePage() {
	useDocumentTitle("New Workspace")
	const navigate = useNavigate()
	const createWorkspace = useCreateWorkspace()

	const [name, setName] = useState(DEFAULT_TEMPLATE.name)
	const [systemPrompt, setSystemPrompt] = useState(DEFAULT_TEMPLATE.description)

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		createWorkspace.mutate(
			{
				name,
				systemPrompt: systemPrompt || undefined,
			},
			{
				onSuccess: data => {
					navigate({
						to: "/workspaces/$workspaceId",
						params: { workspaceId: data.id },
					})
				},
			},
		)
	}

	return (
		<div className="flex flex-col items-center justify-center min-h-full">
			<Card className="w-full max-w-lg pt-0 overflow-hidden">
				<div className="px-4 pt-4">
					<img
						src={DEFAULT_TEMPLATE.image}
						alt={DEFAULT_TEMPLATE.displayName}
						className="aspect-video w-full object-cover rounded-lg"
					/>
				</div>
				<CardHeader>
					<CardTitle>Create Workspace</CardTitle>
					<CardDescription>Set up your Flamecast workspace.</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">Name</Label>
								<Input
									id="name"
									placeholder="alfred"
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
						<div className="mt-6 flex gap-2 justify-end">
							{!createWorkspace.isPending && (
								<Button
									type="button"
									variant="outline"
									onClick={() => navigate({ to: "/workspaces" })}
								>
									Cancel
								</Button>
							)}
							<Button
								type="submit"
								disabled={!name || createWorkspace.isPending}
							>
								{createWorkspace.isPending && <Spinner />}
								{createWorkspace.isPending ? "Creating..." : "Continue"}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	)
}
