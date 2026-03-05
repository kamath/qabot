import { useState } from "react"
import { useCreateTask } from "@/lib/mutations"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { SendIcon } from "lucide-react"

export function CreateTaskForm({ workspaceId }: { workspaceId: string }) {
	const [prompt, setPrompt] = useState("")
	const createTask = useCreateTask(workspaceId)

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!prompt.trim()) return
		createTask.mutate(
			{ prompt: prompt.trim() },
			{
				onSuccess: () => setPrompt(""),
			},
		)
	}

	return (
		<Card>
			<CardContent className="pt-6">
				<form onSubmit={handleSubmit} className="flex gap-2">
					<Textarea
						placeholder="Describe a task for the agent..."
						value={prompt}
						onChange={e => setPrompt(e.target.value)}
						rows={2}
						className="flex-1 resize-none"
					/>
					<Button
						type="submit"
						disabled={!prompt.trim() || createTask.isPending}
						className="self-end"
					>
						<SendIcon className="size-4" />
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}
