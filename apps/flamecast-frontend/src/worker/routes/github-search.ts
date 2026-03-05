import { Hono } from "hono"
import {
	sessionMiddleware,
	getGitHubAccessToken,
	type AuthEnv,
} from "@flamecast/auth"

type PullRequestSearchItem = {
	html_url: string
	title: string
	state: "open" | "closed"
	pull_request?: { url?: string }
}

type PullRequestDetails = {
	state: "open" | "closed"
	draft?: boolean
	merged_at?: string | null
	requested_reviewers?: unknown[]
	requested_teams?: unknown[]
	statuses_url?: string
}

type PullRequestStatus =
	| PullRequestDetails["state"]
	| "merged"
	| "draft"
	| "review requested"

type CommitCombinedStatus = {
	state: "success" | "failure" | "error" | "pending"
}

const githubSearch = new Hono<AuthEnv<Cloudflare.Env>>()
	.use(sessionMiddleware)
	.get("/search", async c => {
		const kind =
			c.req.query("kind") === "pull_request" ? "pull_request" : "repo"
		const q = c.req.query("q")?.trim() ?? ""
		if (!q && kind === "repo") return c.json({ items: [] })

		const db = c.get("db")
		const authRow = c.get("authRow")

		const accessToken = await getGitHubAccessToken(db, authRow.userId)
		if (!accessToken) return c.json({ error: "GitHub token not found" }, 403)

		const url = new URL(
			kind === "pull_request"
				? "https://api.github.com/search/issues"
				: "https://api.github.com/search/repositories",
		)
		if (kind === "pull_request") {
			if (q) {
				url.searchParams.set("q", `${q} is:pr involves:@me`)
			} else {
				url.searchParams.set("q", "is:open is:pr involves:@me")
				url.searchParams.set("sort", "updated")
				url.searchParams.set("order", "desc")
			}
		} else {
			url.searchParams.set("q", q)
		}
		url.searchParams.set("per_page", "8")

		const res = await fetch(url.toString(), {
			headers: {
				Authorization: `token ${accessToken}`,
				Accept: "application/vnd.github.v3+json",
				"User-Agent": "Flamecast",
			},
		})

		if (!res.ok) {
			return c.json({ error: `GitHub API error: ${res.status}` }, 502)
		}

		if (kind === "pull_request") {
			const data = (await res.json()) as { items: PullRequestSearchItem[] }
			const enrichedItems = await Promise.all(
				data.items.map(item => enrichPullRequestItem(item, accessToken)),
			)

			return c.json({
				items: enrichedItems,
			})
		}

		const data = (await res.json()) as {
			items: { full_name: string }[]
		}

		return c.json({
			items: data.items.map(item => ({
				value: item.full_name,
				label: item.full_name,
			})),
		})
	})

export default githubSearch

async function enrichPullRequestItem(
	item: PullRequestSearchItem,
	accessToken: string,
) {
	let status: PullRequestStatus = item.state
	let checksState: "success" | "failure" | "pending" | "none" = "none"

	const pullRequestApiUrl = item.pull_request?.url
	if (pullRequestApiUrl) {
		const prRes = await fetch(pullRequestApiUrl, {
			headers: {
				Authorization: `token ${accessToken}`,
				Accept: "application/vnd.github.v3+json",
				"User-Agent": "Flamecast",
			},
		})

		if (prRes.ok) {
			const pr = (await prRes.json()) as PullRequestDetails
			status = derivePullRequestStatus(pr)
			if (pr.statuses_url) {
				const statusRes = await fetch(pr.statuses_url, {
					headers: {
						Authorization: `token ${accessToken}`,
						Accept: "application/vnd.github.v3+json",
						"User-Agent": "Flamecast",
					},
				})
				if (statusRes.ok) {
					const combinedStatus =
						(await statusRes.json()) as CommitCombinedStatus
					checksState = mapChecksState(combinedStatus.state)
				}
			}
		}
	}

	return {
		value: item.html_url,
		label: formatPullRequestLabel(item.html_url, item.title),
		title: item.title,
		status,
		checksState,
	}
}

function formatPullRequestLabel(url: string, fallbackLabel: string) {
	const match = url.match(
		/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/([0-9]+)$/i,
	)
	if (match) {
		const [, repoName, pullNumber] = match
		return `${repoName}#${pullNumber}`
	}
	return fallbackLabel || url
}

function derivePullRequestStatus(pr: PullRequestDetails): PullRequestStatus {
	if (pr.state === "closed") {
		return pr.merged_at ? "merged" : "closed"
	}
	if (pr.draft) {
		return "draft"
	}
	if ((pr.requested_reviewers?.length ?? 0) > 0) {
		return "review requested"
	}
	if ((pr.requested_teams?.length ?? 0) > 0) {
		return "review requested"
	}
	return "open"
}

function mapChecksState(
	state: CommitCombinedStatus["state"],
): "success" | "failure" | "pending" | "none" {
	if (state === "success") return "success"
	if (state === "pending") return "pending"
	if (state === "failure" || state === "error") return "failure"
	return "none"
}
