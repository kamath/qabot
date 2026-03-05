import { resolveWorkspace } from "../../lib/resolve-workspace.js"

export async function handleWorkspaceGet(ref: string) {
	const ws = await resolveWorkspace(ref)

	console.log(`  Name:       ${ws.name}`)
	console.log(`  ID:         ${ws.id}`)
	console.log(`  Status:     ${ws.status}`)
	console.log(`  Repo:       ${ws.githubRepo}`)
	console.log(`  Created:    ${ws.createdAt}`)
	console.log(`  Updated:    ${ws.updatedAt}`)
}
