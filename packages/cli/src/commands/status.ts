import { client } from "../lib/auth.js"
import type { WorkspaceItem } from "@flamecast/api/resources/workspaces"
import type { TaskItem } from "@flamecast/api/resources/workspaces/tasks"

export async function handleStatus() {
	const { workspaces } = await client.workspaces.list()

	if (workspaces.length === 0) {
		console.log("No cast members yet. Run `flame cast add` to create one.")
		return
	}

	// Fetch latest task for each workspace
	const entries: { ws: WorkspaceItem; task: TaskItem | null }[] =
		await Promise.all(
			workspaces.map(async ws => {
				try {
					const page = await client.workspaces.tasks.list(ws.id)
					return { ws, task: page.tasks[0] ?? null }
				} catch {
					return { ws, task: null }
				}
			}),
		)

	const nameWidth = Math.max(8, ...entries.map(e => e.ws.name.length))
	const taskWidth = 40

	console.log(
		`  ${"EMPLOYEE".padEnd(nameWidth)}  ${"TASK".padEnd(taskWidth)}  STATUS`,
	)

	for (const { ws, task } of entries) {
		if (!task) {
			console.log(
				`  ${ws.name.padEnd(nameWidth)}  ${"(no tasks)".padEnd(taskWidth)}  -`,
			)
			continue
		}

		const prompt =
			task.prompt.length > taskWidth - 3
				? `${task.prompt.slice(0, taskWidth - 3)}...`
				: task.prompt
		const status = formatStatus(task)

		console.log(
			`  ${ws.name.padEnd(nameWidth)}  ${prompt.padEnd(taskWidth)}  ${status}`,
		)
	}
}

function formatStatus(task: TaskItem) {
	const ago = timeAgo(task.lastUpdatedAt)

	switch (task.status) {
		case "completed":
			return `\u2713 completed (${ago})`
		case "working":
			return `\u27F3 working (${elapsed(task.createdAt)})`
		case "submitted":
			return `\u27F3 submitted (${elapsed(task.createdAt)})`
		case "input_required":
			return `? input required`
		case "failed":
			return `\u2717 failed (${ago})`
		case "cancelled":
			return `\u2717 cancelled (${ago})`
		default:
			return task.status
	}
}

function timeAgo(iso: string) {
	const diff = Date.now() - new Date(iso).getTime()
	const seconds = Math.floor(diff / 1000)
	if (seconds < 60) return "just now"
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `${minutes}m ago`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h ago`
	const days = Math.floor(hours / 24)
	return `${days}d ago`
}

function elapsed(iso: string) {
	const diff = Date.now() - new Date(iso).getTime()
	const seconds = Math.floor(diff / 1000)
	if (seconds < 60) return `${seconds}s elapsed`
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `${minutes}m elapsed`
	const hours = Math.floor(minutes / 60)
	return `${hours}h elapsed`
}
