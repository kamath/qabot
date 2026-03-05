import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/lib/api-context"
import { skillsListQuery } from "@/lib/queries"
import { useAddSkill, useRemoveSkill } from "@/lib/mutations"
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
import { ExternalLinkIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

export function WorkspaceSkillsCard({ workspaceId }: { workspaceId: string }) {
	const client = useApiClient()
	const [dialogOpen, setDialogOpen] = useState(false)
	const [skillInput, setSkillInput] = useState("")

	const { data, isLoading } = useQuery(skillsListQuery(client, workspaceId))
	const addSkill = useAddSkill(workspaceId)
	const removeSkill = useRemoveSkill(workspaceId)

	const skills = data?.skills ?? []

	function handleAdd(e: React.FormEvent) {
		e.preventDefault()
		if (!skillInput.trim()) return

		addSkill.mutate(
			{ skill: skillInput.trim() },
			{
				onSuccess: () => {
					setDialogOpen(false)
					setSkillInput("")
					toast.success("Skill added")
				},
				onError: () => {
					toast.error("Failed to add skill")
				},
			},
		)
	}

	function handleRemove(qualifiedName: string) {
		removeSkill.mutate(qualifiedName, {
			onSuccess: () => toast.success("Skill removed"),
			onError: () => toast.error("Failed to remove skill"),
		})
	}

	function closeDialog() {
		setDialogOpen(false)
		setSkillInput("")
		addSkill.reset()
	}

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Skills</CardTitle>
					<CardDescription>
						Install skills from the registry to extend your agent's
						capabilities.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<button
						type="button"
						onClick={() => setDialogOpen(true)}
						className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
					>
						<PlusIcon className="size-4" />
						Add Skill
					</button>

					{isLoading ? (
						<div className="space-y-2">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
						</div>
					) : skills.length > 0 ? (
						<div className="space-y-1">
							{skills.map(skill => (
								<div
									key={skill.qualifiedName}
									className="flex items-center justify-between rounded-md px-3 py-2 text-sm"
								>
									<div className="min-w-0 flex-1">
										<span className="font-medium">{skill.qualifiedName}</span>
										{skill.description && (
											<p className="truncate text-xs text-muted-foreground">
												{skill.description}
											</p>
										)}
									</div>
									<div className="flex shrink-0 items-center gap-1">
										{skill.gitUrl && (
											<a
												href={skill.gitUrl}
												target="_blank"
												rel="noopener noreferrer"
											>
												<Button variant="ghost" size="icon" className="size-8">
													<ExternalLinkIcon className="size-3.5" />
												</Button>
											</a>
										)}
										<Button
											variant="ghost"
											size="icon"
											className="size-8"
											onClick={() => handleRemove(skill.qualifiedName)}
											disabled={removeSkill.isPending}
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
							<DialogTitle>Add Skill</DialogTitle>
							<DialogDescription>
								Enter a qualified skill name (e.g. "anthropics/frontend-design")
								or a Git URL.
							</DialogDescription>
						</DialogHeader>
						<div className="mt-4 space-y-4">
							<div className="space-y-2">
								<Label htmlFor="skill-name">Skill</Label>
								<Input
									id="skill-name"
									placeholder="e.g. anthropics/frontend-design"
									value={skillInput}
									onChange={e => setSkillInput(e.target.value)}
									required
								/>
							</div>
						</div>
						<DialogFooter className="mt-6">
							<Button
								type="submit"
								disabled={!skillInput.trim() || addSkill.isPending}
							>
								{addSkill.isPending ? "Adding..." : "Add"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	)
}
