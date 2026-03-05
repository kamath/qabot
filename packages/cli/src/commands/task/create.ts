import { client } from "../../lib/auth.js"
import { resolveWorkspace } from "../../lib/resolve-workspace.js"
import { openBrowser } from "../../lib/open-browser.js"
import { APIError } from "@flamecast/api"

export async function handleTaskCreate(
	promptParts: string[],
	workspaceRef?: string,
) {
	const prompt = promptParts.join(" ")
	if (!prompt) {
		console.error("Usage: flame task create <prompt> [-w workspace]")
		return
	}

	const ws = await resolveWorkspace(workspaceRef)

	try {
		const task = await client.workspaces.tasks.create(ws.id, { prompt })

		console.log(`Task dispatched to ${ws.name}.`)
		if (task.workflowRunId) {
			console.log(
				`  Run: https://github.com/${ws.githubRepo}/actions/runs/${task.workflowRunId}`,
			)
		}
		console.log(`  Task ID: ${task.id}`)
	} catch (err) {
		// Handle 428 Precondition Required — MCP connections need OAuth
		if (err instanceof APIError && err.status === 428) {
			const preflight = err.error as {
				ready: string[]
				authRequired: Array<{ name: string; authorizationUrl: string }>
				errors: Array<{ name: string; error: string }>
			}

			if (preflight.authRequired.length > 0) {
				console.error("Some MCP connections require authorization:")
				for (const auth of preflight.authRequired) {
					console.error(`  ${auth.name}: ${auth.authorizationUrl}`)
					openBrowser(auth.authorizationUrl)
				}
				console.error(
					"\nComplete authorization in your browser, then retry the task.",
				)
			}

			if (preflight.errors.length > 0) {
				console.error("Some MCP connections have errors:")
				for (const err of preflight.errors) {
					console.error(`  ${err.name}: ${err.error}`)
				}
			}
			return
		}
		throw err
	}
}
