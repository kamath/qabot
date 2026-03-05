import { RequestError } from "@octokit/request-error"
import { getOctokit } from "./octokit"

function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

export async function dispatchWorkflow(opts: {
	accessToken: string
	owner: string
	repo: string
	ref?: string
	inputs: Record<string, string>
}): Promise<{
	dispatched: boolean
	workflowRunId: number | null
	dispatchStatus?: number
	dispatchError?: string
}> {
	const { accessToken, owner, repo, inputs } = opts
	const octokit = getOctokit(accessToken)

	// Determine dispatch ref
	let dispatchRef = opts.ref
	if (!dispatchRef) {
		try {
			const { data: repoData } = await octokit.repos.get({ owner, repo })
			dispatchRef = repoData.default_branch
		} catch {
			dispatchRef = "main"
		}
	}

	const dispatchedAt = Date.now()

	try {
		await octokit.actions.createWorkflowDispatch({
			owner,
			repo,
			workflow_id: "flamecast.yml",
			ref: dispatchRef,
			inputs,
		})
	} catch (err) {
		if (err instanceof RequestError) {
			return {
				dispatched: false,
				workflowRunId: null,
				dispatchStatus: err.status,
				dispatchError: err.message,
			}
		}
		return {
			dispatched: false,
			workflowRunId: null,
			dispatchStatus: 500,
			dispatchError: "Unknown error",
		}
	}

	// Poll for the dispatched run ID
	let workflowRunId: number | null = null
	for (let attempt = 0; attempt < 12; attempt++) {
		try {
			const { data } = await octokit.actions.listWorkflowRuns({
				owner,
				repo,
				workflow_id: "flamecast.yml",
				event: "workflow_dispatch",
				per_page: 20,
			})

			const run = data.workflow_runs.find(
				candidate => Date.parse(candidate.created_at) >= dispatchedAt - 30_000,
			)
			if (run) {
				workflowRunId = run.id
				break
			}
		} catch {
			// Ignore polling errors, keep trying
		}

		await sleep(1_000)
	}

	return {
		dispatched: true,
		workflowRunId,
	}
}
