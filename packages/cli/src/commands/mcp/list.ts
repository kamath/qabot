import { client } from "../../lib/auth.js"
import { resolveWorkspace } from "../../lib/resolve-workspace.js"

export async function handleMcpList(opts: {
	workspace?: string
	all?: boolean
}) {
	if (opts.all) {
		const { workspaces } = await client.workspaces.list()
		const rows: Array<{
			workspace: string
			server: string
			status: string
			mcpUrl?: string
		}> = []

		for (const ws of workspaces) {
			try {
				const { connections } = await client.workspaces.mcp.list(ws.id)
				for (const c of connections) {
					rows.push({
						workspace: ws.name,
						server: c.server,
						status: c.status,
						mcpUrl: c.mcpUrl,
					})
				}
			} catch {
				// skip workspaces we can't read
			}
		}

		if (rows.length === 0) {
			console.log("No MCP connections in any workspace.")
			return
		}

		const wsWidth = Math.max(9, ...rows.map(r => r.workspace.length))
		const serverWidth = Math.max(6, ...rows.map(r => r.server.length))
		const statusWidth = Math.max(6, ...rows.map(r => r.status.length))

		console.log(
			`${"WORKSPACE".padEnd(wsWidth)}  ${"SERVER".padEnd(serverWidth)}  ${"STATUS".padEnd(statusWidth)}  URL`,
		)
		for (const row of rows) {
			console.log(
				`${row.workspace.padEnd(wsWidth)}  ${row.server.padEnd(serverWidth)}  ${row.status.padEnd(statusWidth)}  ${row.mcpUrl ?? ""}`,
			)
		}
		return
	}

	const ws = await resolveWorkspace(opts.workspace)
	const { connections } = await client.workspaces.mcp.list(ws.id)

	if (connections.length === 0) {
		console.log("No MCP connections configured.")
		console.log("Add one with: flame mcp add <server>")
		return
	}

	// Print table
	const serverWidth = Math.max(6, ...connections.map(c => c.server.length))
	const statusWidth = Math.max(6, ...connections.map(c => c.status.length))

	console.log(
		`${"SERVER".padEnd(serverWidth)}  ${"STATUS".padEnd(statusWidth)}  URL`,
	)
	for (const conn of connections) {
		console.log(
			`${conn.server.padEnd(serverWidth)}  ${conn.status.padEnd(statusWidth)}  ${conn.mcpUrl ?? ""}`,
		)
	}
}
