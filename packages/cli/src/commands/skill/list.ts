import { client } from "../../lib/auth.js"
import { resolveWorkspace } from "../../lib/resolve-workspace.js"

export async function handleSkillList(opts: {
	workspace?: string
	all?: boolean
}) {
	if (opts.all) {
		const { workspaces } = await client.workspaces.list()
		const rows: Array<{
			workspace: string
			qualifiedName: string
			description?: string
		}> = []

		for (const ws of workspaces) {
			try {
				const { skills } = await client.workspaces.skills.list(ws.id)
				for (const s of skills) {
					rows.push({
						workspace: ws.name,
						qualifiedName: s.qualifiedName,
						description: s.description,
					})
				}
			} catch {
				// skip workspaces we can't read
			}
		}

		if (rows.length === 0) {
			console.log("No skills installed in any workspace.")
			return
		}

		const wsWidth = Math.max(9, ...rows.map(r => r.workspace.length))
		const nameWidth = Math.max(5, ...rows.map(r => r.qualifiedName.length))

		console.log(
			`${"WORKSPACE".padEnd(wsWidth)}  ${"SKILL".padEnd(nameWidth)}  DESCRIPTION`,
		)
		for (const row of rows) {
			const desc = row.description
				? row.description.length > 50
					? `${row.description.slice(0, 47)}...`
					: row.description
				: ""
			console.log(
				`${row.workspace.padEnd(wsWidth)}  ${row.qualifiedName.padEnd(nameWidth)}  ${desc}`,
			)
		}
		return
	}

	const ws = await resolveWorkspace(opts.workspace)
	const { skills } = await client.workspaces.skills.list(ws.id)

	if (skills.length === 0) {
		console.log("No skills installed.")
		console.log("Add one with: flame skill add <name-or-url>")
		return
	}

	const nameWidth = Math.max(5, ...skills.map(s => s.qualifiedName.length))

	console.log(`${"SKILL".padEnd(nameWidth)}  DESCRIPTION`)
	for (const skill of skills) {
		const desc = skill.description
			? skill.description.length > 60
				? `${skill.description.slice(0, 57)}...`
				: skill.description
			: ""
		console.log(`${skill.qualifiedName.padEnd(nameWidth)}  ${desc}`)
	}
}
