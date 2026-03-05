import { client } from "../../lib/auth.js"
import { resolveWorkspace } from "../../lib/resolve-workspace.js"
import type { TaskItem } from "@flamecast/api/resources/workspaces/tasks"

export async function handleTaskList(opts: {
	workspace?: string
	all?: boolean
}) {
	if (opts.all) {
		const { workspaces } = await client.workspaces.list()
		const rows: Array<{
			workspace: string
			prompt: string
			status: string
			id: string
		}> = []

		for (const ws of workspaces) {
			try {
				const page = await client.workspaces.tasks.list(ws.id)
				for (const t of page.tasks ?? []) {
					rows.push({
						workspace: ws.name,
						prompt: t.prompt,
						status: formatStatus(t),
						id: t.id,
					})
				}
			} catch {
				// skip workspaces we can't read
			}
		}

		if (rows.length === 0) {
			console.log("No tasks in any workspace.")
			return
		}

		const wsWidth = Math.max(9, ...rows.map(r => r.workspace.length))
		const promptWidth = 40
		const statusWidth = Math.max(6, ...rows.map(r => r.status.length))

		console.log(
			`  ${"WORKSPACE".padEnd(wsWidth)}  ${"TASK".padEnd(promptWidth)}  ${"STATUS".padEnd(statusWidth)}  ID`,
		)
		for (const row of rows) {
			const prompt =
				row.prompt.length > promptWidth - 3
					? `${row.prompt.slice(0, promptWidth - 3)}...`
					: row.prompt
			console.log(
				`  ${row.workspace.padEnd(wsWidth)}  ${prompt.padEnd(promptWidth)}  ${row.status.padEnd(statusWidth)}  ${row.id}`,
			)
		}
		return
	}

	const ws = await resolveWorkspace(opts.workspace)
	const page = await client.workspaces.tasks.list(ws.id)
	const tasks = page.tasks ?? []

	if (tasks.length === 0) {
		console.log(
			`No tasks for "${ws.name}". Run \`flame task create <prompt> -w ${ws.name}\` to create one.`,
		)
		return
	}

	const promptWidth = 50
	console.log(`  ${"TASK".padEnd(promptWidth)}  ${"STATUS".padEnd(16)}  ID`)

	for (const task of tasks) {
		const prompt =
			task.prompt.length > promptWidth - 3
				? `${task.prompt.slice(0, promptWidth - 3)}...`
				: task.prompt
		const status = formatStatus(task)
		console.log(
			`  ${prompt.padEnd(promptWidth)}  ${status.padEnd(16)}  ${task.id}`,
		)
	}
}

function formatStatus(task: TaskItem) {
	const ago = timeAgo(task.lastUpdatedAt)

	switch (task.status) {
		case "completed":
			return `done (${ago})`
		case "working":
			return `working (${elapsed(task.createdAt)})`
		case "submitted":
			return `submitted (${elapsed(task.createdAt)})`
		case "input_required":
			return `input required`
		case "failed":
			return `failed (${ago})`
		case "cancelled":
			return `cancelled (${ago})`
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
	if (seconds < 60) return `${seconds}s`
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `${minutes}m`
	const hours = Math.floor(minutes / 60)
	return `${hours}h`
}
