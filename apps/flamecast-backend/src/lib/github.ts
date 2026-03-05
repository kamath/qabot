/**
 * Composable GitHub Git API primitives.
 *
 * Each function wraps a single GitHub REST endpoint so callers can compose
 * them into higher-level flows (add files, remove files, create PRs, etc.)
 * without duplicating the underlying fetch boilerplate.
 */

import type { OctokitClient } from "./octokit"

export interface TreeEntry {
	path: string
	mode: string
	type: string
	sha: string
}

export interface HeadContext {
	defaultBranch: string
	baseSha: string
	baseTreeSha: string
}

function splitRepo(repo: string) {
	const [owner, name] = repo.split("/")
	return { owner: owner!, repo: name! }
}

// ---------------------------------------------------------------------------
// 1. Get HEAD context (default branch, HEAD commit SHA, tree SHA)
// ---------------------------------------------------------------------------
export async function getHeadContext(
	repo: string,
	octokit: OctokitClient,
): Promise<HeadContext> {
	const r = splitRepo(repo)

	const { data: repoData } = await octokit.repos.get(r)
	const defaultBranch = repoData.default_branch

	const { data: refData } = await octokit.git.getRef({
		...r,
		ref: `heads/${defaultBranch}`,
	})
	const baseSha = refData.object.sha

	const { data: commitData } = await octokit.git.getCommit({
		...r,
		commit_sha: baseSha,
	})

	return { defaultBranch, baseSha, baseTreeSha: commitData.tree.sha }
}

// ---------------------------------------------------------------------------
// 2. Create a single blob, return its SHA
// ---------------------------------------------------------------------------
export async function createBlob(
	repo: string,
	octokit: OctokitClient,
	content: string,
	encoding: "utf-8" | "base64" = "base64",
): Promise<string> {
	const { data } = await octokit.git.createBlob({
		...splitRepo(repo),
		content,
		encoding,
	})
	return data.sha
}

// ---------------------------------------------------------------------------
// 3. Create blobs for multiple files, return tree entries
// ---------------------------------------------------------------------------
export async function createBlobs(
	repo: string,
	octokit: OctokitClient,
	files: Array<{ path: string; content: string }>,
): Promise<TreeEntry[]> {
	const entries: TreeEntry[] = []
	for (const file of files) {
		try {
			const { data } = await octokit.git.createBlob({
				...splitRepo(repo),
				content: file.content,
				encoding: "base64",
			})
			entries.push({
				path: file.path,
				mode: "100644",
				type: "blob",
				sha: data.sha,
			})
		} catch {
			console.error(`Failed to create blob for ${file.path}`)
		}
	}
	return entries
}

// ---------------------------------------------------------------------------
// 4. Get full recursive tree
// ---------------------------------------------------------------------------
export async function getFullTree(
	repo: string,
	octokit: OctokitClient,
	treeSha: string,
): Promise<TreeEntry[]> {
	const { data } = await octokit.git.getTree({
		...splitRepo(repo),
		tree_sha: treeSha,
		recursive: "1",
	})
	return data.tree as TreeEntry[]
}

// ---------------------------------------------------------------------------
// 5. Create a tree (with optional base_tree for incremental updates)
// ---------------------------------------------------------------------------
export async function createTree(
	repo: string,
	octokit: OctokitClient,
	entries: TreeEntry[],
	baseTreeSha?: string,
): Promise<string> {
	const { data } = await octokit.git.createTree({
		...splitRepo(repo),
		tree: entries.map(e => ({
			path: e.path,
			mode: e.mode as "100644" | "100755" | "040000" | "160000" | "120000",
			type: e.type as "blob" | "tree" | "commit",
			sha: e.sha,
		})),
		base_tree: baseTreeSha,
	})
	return data.sha
}

// ---------------------------------------------------------------------------
// 6. Create a commit
// ---------------------------------------------------------------------------
export async function createCommit(
	repo: string,
	octokit: OctokitClient,
	message: string,
	treeSha: string,
	parentSha: string,
): Promise<string> {
	const { data } = await octokit.git.createCommit({
		...splitRepo(repo),
		message,
		tree: treeSha,
		parents: [parentSha],
	})
	return data.sha
}

// ---------------------------------------------------------------------------
// 7. Update an existing branch ref (PATCH)
// ---------------------------------------------------------------------------
export async function updateBranchRef(
	repo: string,
	octokit: OctokitClient,
	branch: string,
	commitSha: string,
): Promise<void> {
	await octokit.git.updateRef({
		...splitRepo(repo),
		ref: `heads/${branch}`,
		sha: commitSha,
	})
}

// ---------------------------------------------------------------------------
// 8. Create a new branch ref (POST)
// ---------------------------------------------------------------------------
export async function createBranchRef(
	repo: string,
	octokit: OctokitClient,
	branchName: string,
	commitSha: string,
): Promise<void> {
	await octokit.git.createRef({
		...splitRepo(repo),
		ref: `refs/heads/${branchName}`,
		sha: commitSha,
	})
}

// ---------------------------------------------------------------------------
// 9. Create a pull request
// ---------------------------------------------------------------------------
export async function createPullRequest(
	repo: string,
	octokit: OctokitClient,
	opts: { title: string; head: string; base: string; body: string },
): Promise<{ htmlUrl: string; number: number }> {
	const { data } = await octokit.pulls.create({
		...splitRepo(repo),
		...opts,
	})
	return { htmlUrl: data.html_url, number: data.number }
}

// ---------------------------------------------------------------------------
// 10. Merge a pull request
// ---------------------------------------------------------------------------
export async function mergePullRequest(
	repo: string,
	octokit: OctokitClient,
	pullNumber: number,
): Promise<void> {
	await octokit.pulls.merge({
		...splitRepo(repo),
		pull_number: pullNumber,
		merge_method: "squash",
	})
}
