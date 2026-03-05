import type { WorkspaceItem } from "@flamecast/api/resources/workspaces"
import { client } from "../../lib/auth.js"

export async function handleCastList() {
	let workspaces: WorkspaceItem[]
	try {
		const result = await client.workspaces.list()
		workspaces = result.workspaces
	} catch {
		console.error("Failed to fetch workspaces. Try re-authenticating.")
		process.exit(1)
	}

	if (workspaces.length === 0) {
		console.log("No cast members yet. Run `flame cast add` to create one.")
		return
	}

	const nameWidth = Math.max(6, ...workspaces.map(w => w.name.length))
	const statusWidth = 12
	const repoWidth = Math.max(4, ...workspaces.map(w => w.githubRepo.length))

	console.log(
		`  ${"NAME".padEnd(nameWidth)}  ${"STATUS".padEnd(statusWidth)}  ${"REPO".padEnd(repoWidth)}  CREATED`,
	)

	for (const ws of workspaces) {
		const ago = timeAgo(ws.createdAt)
		console.log(
			`  ${ws.name.padEnd(nameWidth)}  ${ws.status.padEnd(statusWidth)}  ${ws.githubRepo.padEnd(repoWidth)}  ${ago}`,
		)
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
