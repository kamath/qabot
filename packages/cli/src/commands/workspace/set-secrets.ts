import { client } from "../../lib/auth.js"
import { resolveWorkspace } from "../../lib/resolve-workspace.js"

export async function handleWorkspaceSetSecrets(
	ref: string,
	secretArgs: string[],
) {
	const ws = await resolveWorkspace(ref)

	const secrets: Record<string, string> = {}
	for (const arg of secretArgs) {
		const eqIdx = arg.indexOf("=")
		if (eqIdx === -1) {
			console.error(`Invalid secret format: "${arg}". Expected KEY=VALUE.`)
			process.exit(1)
		}
		secrets[arg.slice(0, eqIdx)] = arg.slice(eqIdx + 1)
	}

	if (Object.keys(secrets).length === 0) {
		console.error(
			"No secrets provided. Usage: flame workspace set-secrets <workspace> KEY=VALUE ...",
		)
		process.exit(1)
	}

	await client.workspaces.secrets.set(ws.id, { secrets })
	console.log(`Set ${Object.keys(secrets).length} secret(s) on "${ws.name}".`)
}
