import { createInterface } from "node:readline"
import { client } from "../../lib/auth.js"
import { resolveWorkspace } from "../../lib/resolve-workspace.js"
import { openBrowser } from "../../lib/open-browser.js"

export async function handleMcpAdd(
	server: string,
	opts: { workspace?: string },
) {
	const ws = await resolveWorkspace(opts.workspace)

	const { connection: conn } = await client.workspaces.mcp.add(ws.id, {
		server,
	})

	if (conn.status === "auth_required" && conn.authorizationUrl) {
		console.log(`OAuth required for "${conn.server}".`)
		openBrowser(conn.authorizationUrl)

		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		})
		await new Promise<void>(resolve => {
			rl.question("Press Enter after completing authorization...", () => {
				rl.close()
				resolve()
			})
		})

		// Re-call with connectionId to verify the same connection
		const verifyBody: { server: string; connectionId?: string } = { server }
		if (conn.connectionId) verifyBody.connectionId = conn.connectionId

		const { connection: verified } = await client.workspaces.mcp.add(
			ws.id,
			verifyBody,
		)

		if (verified.status === "ready") {
			console.log(`Connection "${conn.server}" added and authorized.`)
			return
		}
		if (verified.status === "auth_required") {
			console.error(
				"Authorization not completed. Run `flame mcp add` again after authorizing.",
			)
			process.exitCode = 1
			return
		}
	}

	console.log(`Connection "${conn.server}" added.`)
}
