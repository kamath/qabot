import { client } from "../../lib/auth.js"
import { resolveWorkspace } from "../../lib/resolve-workspace.js"

export async function handleWorkspaceSetDefault(ref: string) {
	const ws = await resolveWorkspace(ref)
	await client.workspaces.default.set({ workspaceId: ws.id })
	console.log(`Default workspace set to "${ws.name}".`)
}
