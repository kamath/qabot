import { client } from "../lib/auth.js"

export async function handleResult(name: string) {
	if (!name) {
		console.error("Usage: flame result <name> latest")
		process.exit(1)
	}

	// Find workspace by name
	const { workspaces } = await client.workspaces.list()
	const ws = workspaces.find(w => w.name.toLowerCase() === name.toLowerCase())

	if (!ws) {
		console.error(
			`No cast member named "${name}". Run \`flame cast\` to list them.`,
		)
		process.exit(1)
	}

	// Get latest task
	const page = await client.workspaces.tasks.list(ws.id)
	const task = page.tasks[0]

	if (!task) {
		console.log(
			`${ws.name} has no tasks yet. Run \`flame run ${ws.name} <prompt>\` to dispatch one.`,
		)
		return
	}

	// Get full task details
	const { task: detail } = await client.workspaces.tasks.get(task.id, {
		workspaceId: ws.id,
	})

	// Display result
	const statusLine = formatStatusLine(detail)
	console.log(`  ${statusLine}`)

	if (detail.workflowRunId) {
		console.log(
			`  \u2192 View run: https://github.com/${ws.githubRepo}/actions/runs/${detail.workflowRunId}`,
		)
	}

	if (detail.errorMessage) {
		console.log(`  \u2192 Error: ${detail.errorMessage}`)
	}
}

function formatStatusLine(task: {
	status: string
	createdAt: string
	completedAt: string | null
	startedAt: string | null
}) {
	switch (task.status) {
		case "completed": {
			const duration = formatDuration(
				task.startedAt || task.createdAt,
				task.completedAt || new Date().toISOString(),
			)
			return `\u2713 Completed in ${duration}`
		}
		case "working": {
			const elapsed = formatDuration(
				task.startedAt || task.createdAt,
				new Date().toISOString(),
			)
			return `\u27F3 Working (${elapsed} elapsed)`
		}
		case "submitted":
			return `\u27F3 Submitted, waiting to start...`
		case "input_required":
			return `? Input required`
		case "failed": {
			const duration = formatDuration(
				task.startedAt || task.createdAt,
				task.completedAt || new Date().toISOString(),
			)
			return `\u2717 Failed after ${duration}`
		}
		case "cancelled":
			return `\u2717 Cancelled`
		default:
			return task.status
	}
}

function formatDuration(startIso: string, endIso: string) {
	const diff = new Date(endIso).getTime() - new Date(startIso).getTime()
	const seconds = Math.floor(diff / 1000)
	if (seconds < 60) return `${seconds}s`
	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = seconds % 60
	if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
	const hours = Math.floor(minutes / 60)
	const remainingMinutes = minutes % 60
	return `${hours}h ${remainingMinutes}m`
}
