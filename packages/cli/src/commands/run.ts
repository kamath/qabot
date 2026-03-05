import { client } from "../lib/auth.js"

export async function handleRun(name: string, promptParts: string[]) {
	if (!name) {
		console.error("Usage: flame run <name> <prompt>")
		process.exit(1)
	}

	const prompt = promptParts.join(" ")
	if (!prompt) {
		console.error("Usage: flame run <name> <prompt>")
		process.exit(1)
	}

	// Find workspace by name
	const { workspaces } = await client.workspaces.list()
	const ws = workspaces.find(w => w.name.toLowerCase() === name.toLowerCase())

	if (!ws) {
		console.error(
			`No cast member named "${name}". Run \`flame cast\` to list them.`,
		)
		process.exit(1)
	}

	const task = await client.workspaces.tasks.create(ws.id, { prompt })

	console.log(`\u{1F525} Task dispatched to ${ws.name}.`)
	if (task.workflowRunId) {
		console.log(
			`  \u2192 Run: https://github.com/${ws.githubRepo}/actions/runs/${task.workflowRunId}`,
		)
	}
	console.log(`  \u2192 Task ID: ${task.id}`)
	console.log(`\nRun \`flame status\` to check progress.`)
}
