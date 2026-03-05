import { client } from "../../lib/auth.js"
import { resolveWorkspace } from "../../lib/resolve-workspace.js"
import { confirm } from "../../lib/confirm.js"

export async function handleMcpRemove(
	server: string,
	opts: { workspace?: string },
) {
	const ws = await resolveWorkspace(opts.workspace)

	if (!(await confirm(`Remove connection "${server}" from ${ws.name}?`))) {
		console.log("Cancelled.")
		return
	}

	await client.workspaces.mcp.remove(server, { workspaceId: ws.id })
	console.log(`Connection "${server}" removed.`)
}
