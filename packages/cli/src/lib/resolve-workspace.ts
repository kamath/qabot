import type { WorkspaceItem } from "@flamecast/api/resources/workspaces"
import { client } from "./auth.js"

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resolve a workspace from a name, UUID, or "default".
 * If `ref` is omitted/undefined, resolves the user's default workspace.
 */
export async function resolveWorkspace(ref?: string): Promise<WorkspaceItem> {
	// No ref provided → use default
	if (!ref) {
		const { defaultWorkspaceId } = await client.workspaces.default.get()
		if (!defaultWorkspaceId) {
			console.error(
				"No default workspace set. Specify one with -w or run `flame workspace set-default <name>`.",
			)
			process.exit(1)
		}
		return client.workspaces.get(defaultWorkspaceId)
	}

	// UUID → fetch directly
	if (UUID_RE.test(ref)) {
		return client.workspaces.get(ref)
	}

	// Name → list and match
	const { workspaces } = await client.workspaces.list()
	const ws = workspaces.find(w => w.name.toLowerCase() === ref.toLowerCase())
	if (!ws) {
		console.error(
			`No workspace named "${ref}". Run \`flame workspace list\` to see available workspaces.`,
		)
		process.exit(1)
	}
	return ws
}
