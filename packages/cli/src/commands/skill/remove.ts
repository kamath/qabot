import { client } from "../../lib/auth.js"
import { resolveWorkspace } from "../../lib/resolve-workspace.js"
import { confirm } from "../../lib/confirm.js"

export async function handleSkillRemove(
	name: string,
	opts: { workspace?: string },
) {
	const slug = name.includes("/") ? name.split("/").pop()! : name
	const ws = await resolveWorkspace(opts.workspace)

	if (!(await confirm(`Remove skill "${slug}" from ${ws.name}?`))) {
		console.log("Cancelled.")
		return
	}

	await client.workspaces.skills.remove(slug, { workspaceId: ws.id })
	console.log(`Skill "${slug}" removed.`)
}
