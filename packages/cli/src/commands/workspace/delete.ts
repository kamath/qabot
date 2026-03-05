import * as p from "@clack/prompts"
import { client } from "../../lib/auth.js"
import { resolveWorkspace } from "../../lib/resolve-workspace.js"

export async function handleWorkspaceDelete(ref: string) {
	const ws = await resolveWorkspace(ref)

	const confirmed = await p.confirm({
		message: `Delete workspace "${ws.name}" (${ws.githubRepo})? This will also delete the GitHub repo.`,
		initialValue: false,
	})

	if (p.isCancel(confirmed) || !confirmed) {
		console.log("Cancelled.")
		return
	}

	await client.workspaces.delete(ws.id)
	console.log(`Deleted workspace "${ws.name}".`)
}
