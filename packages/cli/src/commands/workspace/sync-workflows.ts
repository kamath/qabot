import { client } from "../../lib/auth.js"
import { resolveWorkspace } from "../../lib/resolve-workspace.js"

export async function handleWorkspaceSyncWorkflows(ref: string) {
	const ws = await resolveWorkspace(ref)

	const result = await client.workspaces.syncWorkflows.sync(ws.id)
	console.log(`Synced workflows for "${ws.name}".`)
	for (const path of result.updated) {
		console.log(`  Updated: ${path}`)
	}
}
