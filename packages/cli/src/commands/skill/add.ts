import { client } from "../../lib/auth.js"
import { resolveWorkspace } from "../../lib/resolve-workspace.js"

export async function handleSkillAdd(
	nameOrUrl: string,
	opts: { workspace?: string },
) {
	const ws = await resolveWorkspace(opts.workspace)

	const { skill } = await client.workspaces.skills.add(ws.id, {
		skill: nameOrUrl,
	})

	const name = skill.qualifiedName ?? nameOrUrl
	console.log(`Skill "${name}" added to ${ws.name}.`)
	if (skill.description) {
		console.log(`  ${skill.description}`)
	}
}
