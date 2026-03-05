import { client } from "../../lib/auth.js"
import { resolveWorkspace } from "../../lib/resolve-workspace.js"

export async function handleTaskGet(taskId: string, workspaceRef?: string) {
	const ws = await resolveWorkspace(workspaceRef)

	const { task, outputs } = await client.workspaces.tasks.get(taskId, {
		workspaceId: ws.id,
	})

	console.log(`  Prompt:     ${task.prompt}`)
	console.log(`  Status:     ${task.status}`)
	console.log(`  Task ID:    ${task.id}`)
	console.log(`  Workspace:  ${ws.name}`)
	console.log(`  Created:    ${task.createdAt}`)

	if (task.startedAt) {
		console.log(`  Started:    ${task.startedAt}`)
	}
	if (task.completedAt) {
		console.log(`  Completed:  ${task.completedAt}`)
	}
	if (task.errorMessage) {
		console.log(`  Error:      ${task.errorMessage}`)
	}
	if (task.workflowRunId) {
		console.log(
			`  Run:        https://github.com/${ws.githubRepo}/actions/runs/${task.workflowRunId}`,
		)
	}
	if (outputs) {
		console.log(`  Outputs:    ${outputs}`)
	}
}
