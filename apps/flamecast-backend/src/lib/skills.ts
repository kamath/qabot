import { RequestError } from "@octokit/request-error"
import type { OctokitClient } from "./octokit"
import {
	getHeadContext,
	createBlob,
	createBlobs,
	getFullTree,
	createTree,
	createCommit,
	updateBranchRef,
} from "./github"

// --- Types ---

interface SkillRegistryEntry {
	qualifiedName: string
	slug: string
	description?: string
	gitUrl: string
}

interface ParsedGitUrl {
	owner: string
	repo: string
	branch: string
	path: string
}

interface SkillFile {
	path: string
	content: string // base64 encoded
}

export interface SkillMeta {
	qualifiedName: string
	description?: string
	gitUrl: string
	installedAt: string
}

/** The index file lives at .claude/skills/.skills-meta.json */
export type SkillsIndex = Record<string, SkillMeta>

// --- Registry ---

export async function fetchSkillFromRegistry(
	qualifiedName: string,
): Promise<SkillRegistryEntry> {
	const res = await fetch(`https://api.smithery.ai/skills/${qualifiedName}`)
	if (!res.ok) {
		throw new Error(
			`Skill "${qualifiedName}" not found in registry (${res.status})`,
		)
	}
	const data = (await res.json()) as {
		slug?: string
		description?: string
		gitUrl: string
	}
	// Derive slug from qualifiedName (e.g. "a5c-ai/architecture-analyzer" → "architecture-analyzer")
	const slug = data.slug ?? qualifiedName.split("/").pop()!
	return {
		qualifiedName,
		slug,
		description: data.description,
		gitUrl: data.gitUrl,
	}
}

// --- Git URL parsing ---

export function parseGitUrl(gitUrl: string): ParsedGitUrl {
	const match = gitUrl.match(
		/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/,
	)
	if (!match) {
		throw new Error(`Cannot parse git URL: ${gitUrl}`)
	}
	return {
		owner: match[1],
		repo: match[2],
		branch: match[3],
		path: match[4],
	}
}

export function deriveSlugFromGitUrl(gitUrl: string): string {
	const parsed = parseGitUrl(gitUrl)
	return parsed.path.split("/").pop()!
}

export function deriveQualifiedNameFromGitUrl(gitUrl: string): string {
	const parsed = parseGitUrl(gitUrl)
	const lastSegment = parsed.path.split("/").pop()!
	return `${parsed.owner}/${lastSegment}`
}

/**
 * Validate that fetched files contain a SKILL.md at the root.
 * Throws if not found.
 */
export function validateSkillFiles(files: SkillFile[]): void {
	const hasSkillMd = files.some(f => f.path.toLowerCase() === "skill.md")
	if (!hasSkillMd) {
		throw new Error(
			"Not a valid skill: directory must contain a SKILL.md file at its root",
		)
	}
}

/**
 * Try to extract a description from the fetched skill files.
 * Looks for the first non-heading line of text in SKILL.md.
 */
export function extractDescriptionFromFiles(
	files: SkillFile[],
): string | undefined {
	const skillMd = files.find(f => f.path.toLowerCase() === "skill.md")
	if (!skillMd) return undefined
	try {
		const content = atob(skillMd.content.replace(/\n/g, ""))
		for (const line of content.split("\n")) {
			const trimmed = line.trim()
			if (!trimmed || trimmed.startsWith("#")) continue
			return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed
		}
	} catch {
		// ignore decode errors
	}
	return undefined
}

// --- Fetch skill files from GitHub ---

export async function fetchSkillFiles(
	owner: string,
	repo: string,
	branch: string,
	path: string,
	octokit: OctokitClient,
): Promise<SkillFile[]> {
	const files: SkillFile[] = []

	const { data } = await octokit.repos.getContent({
		owner,
		repo,
		path,
		ref: branch,
	})

	if (!Array.isArray(data)) {
		throw new Error(`Expected directory listing for ${owner}/${repo}/${path}`)
	}

	for (const entry of data) {
		if (entry.type === "dir") {
			const subFiles = await fetchSkillFiles(
				owner,
				repo,
				branch,
				entry.path,
				octokit,
			)
			files.push(...subFiles)
		} else if (entry.type === "file") {
			try {
				const { data: fileData } = await octokit.repos.getContent({
					owner,
					repo,
					path: entry.path,
					ref: branch,
				})
				if (!Array.isArray(fileData) && "content" in fileData) {
					const relativePath = entry.path.startsWith(`${path}/`)
						? entry.path.slice(path.length + 1)
						: entry.name
					files.push({ path: relativePath, content: fileData.content })
				}
			} catch {
				// skip files that fail to fetch
			}
		}
	}

	return files
}

// --- Commit skill files to workspace repo ---

export async function commitSkillFiles(
	repo: string,
	slug: string,
	files: SkillFile[],
	octokit: OctokitClient,
	meta: SkillMeta,
): Promise<void> {
	const { defaultBranch, baseSha, baseTreeSha } = await getHeadContext(
		repo,
		octokit,
	)

	// Create blobs for skill files
	const treeItems = await createBlobs(
		repo,
		octokit,
		files.map(f => ({
			path: `.claude/skills/${slug}/${f.path}`,
			content: f.content,
		})),
	)

	// Update centralized skills index
	const existingIndex = await fetchSkillsIndex(repo, octokit)
	existingIndex[slug] = meta
	const indexContent = btoa(JSON.stringify(existingIndex, null, 2))
	const indexSha = await createBlob(repo, octokit, indexContent, "base64")
	treeItems.push({
		path: SKILLS_INDEX_PATH,
		mode: "100644",
		type: "blob",
		sha: indexSha,
	})

	if (treeItems.length === 0) {
		throw new Error("Failed to create any file blobs")
	}

	const treeSha = await createTree(repo, octokit, treeItems, baseTreeSha)
	const commitSha = await createCommit(
		repo,
		octokit,
		`Add skill: ${slug}`,
		treeSha,
		baseSha,
	)
	await updateBranchRef(repo, octokit, defaultBranch, commitSha)
}

// --- Remove skill files from workspace repo ---

export async function removeSkillFiles(
	repo: string,
	slug: string,
	octokit: OctokitClient,
): Promise<void> {
	const { defaultBranch, baseSha, baseTreeSha } = await getHeadContext(
		repo,
		octokit,
	)

	// Get full recursive tree and filter out the skill's files
	const fullTree = await getFullTree(repo, octokit, baseTreeSha)

	const prefix = `.claude/skills/${slug}/`
	const filtered = fullTree.filter(
		entry => !entry.path.startsWith(prefix) && entry.type === "blob",
	)

	if (filtered.length === fullTree.filter(e => e.type === "blob").length) {
		throw new Error(`Skill "${slug}" not found in repository`)
	}

	// Update the skills index: remove this slug's entry
	const existingIndex = await fetchSkillsIndex(repo, octokit)
	delete existingIndex[slug]

	const treeEntries = filtered.map(entry => ({
		path: entry.path,
		mode: entry.mode,
		type: entry.type,
		sha: entry.sha,
	}))

	// Replace the index blob in the tree
	if (Object.keys(existingIndex).length > 0) {
		const indexContent = btoa(JSON.stringify(existingIndex, null, 2))
		const indexSha = await createBlob(repo, octokit, indexContent, "base64")
		const withoutOldIndex = treeEntries.filter(
			e => e.path !== SKILLS_INDEX_PATH,
		)
		withoutOldIndex.push({
			path: SKILLS_INDEX_PATH,
			mode: "100644",
			type: "blob",
			sha: indexSha,
		})
		treeEntries.length = 0
		treeEntries.push(...withoutOldIndex)
	} else {
		// No skills left — remove the index file too
		const idx = treeEntries.findIndex(e => e.path === SKILLS_INDEX_PATH)
		if (idx !== -1) treeEntries.splice(idx, 1)
	}

	// Create new tree without the skill files (no base_tree — full replacement)
	const treeSha = await createTree(repo, octokit, treeEntries)
	const commitSha = await createCommit(
		repo,
		octokit,
		`Remove skill: ${slug}`,
		treeSha,
		baseSha,
	)
	await updateBranchRef(repo, octokit, defaultBranch, commitSha)
}

// --- Skills index ---

const SKILLS_INDEX_PATH = ".claude/skills/.skills-meta.json"

export async function fetchSkillsIndex(
	repo: string,
	octokit: OctokitClient,
): Promise<SkillsIndex> {
	try {
		const [owner, name] = repo.split("/")
		const { data } = await octokit.repos.getContent({
			owner: owner!,
			repo: name!,
			path: SKILLS_INDEX_PATH,
		})
		if (!Array.isArray(data) && "content" in data) {
			return JSON.parse(atob(data.content.replace(/\n/g, ""))) as SkillsIndex
		}
		return {}
	} catch (err) {
		if (err instanceof RequestError && err.status === 404) return {}
		return {}
	}
}

// --- List installed skills ---

export async function listInstalledSkills(
	repo: string,
	octokit: OctokitClient,
): Promise<
	Array<{ qualifiedName: string; slug: string; description?: string }>
> {
	try {
		const [owner, name] = repo.split("/")
		const { data } = await octokit.repos.getContent({
			owner: owner!,
			repo: name!,
			path: ".claude/skills",
		})

		if (!Array.isArray(data)) return []

		const dirs = data.filter((e: { type: string }) => e.type === "dir")
		if (dirs.length === 0) return []

		const index = await fetchSkillsIndex(repo, octokit)

		return dirs.map((e: { name: string }) => {
			const meta = index[e.name]
			return {
				qualifiedName: meta?.qualifiedName ?? e.name,
				slug: e.name,
				description: meta?.description,
			}
		})
	} catch (err) {
		if (err instanceof RequestError && err.status === 404) return []
		throw err
	}
}
