import * as p from "@clack/prompts"
import { saveConfig } from "../../lib/config.js"
import { spawnSync } from "node:child_process"
import {
	client,
	authenticateViaBrowser,
	verifyEmailAndExchange,
	exchangeForApiKey,
} from "../../lib/auth.js"
import { openBrowser } from "../../lib/open-browser.js"
import { generateEmployeeName } from "../../lib/names.js"
import { detectClaudeCode, discoverLocalConfig } from "../../lib/detect.js"
import type { McpServerInfo } from "../../lib/detect.js"

export async function handleCastAdd() {
	p.intro("\u{1F525} flamecast v0.1.0")

	// ── Check existing auth ──────────────────────────
	let username: string | null = null

	try {
		const user = await client.github.user()
		username = user.login
	} catch {}

	const needsSetup = !username

	if (needsSetup) {
		p.log.step(
			"\u2500\u2500 Setup (one-time) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
		)

		// Step 1: Authenticate with Flamecast
		const s = p.spinner()
		s.start("Starting authentication...")
		try {
			const result = await authenticateViaBrowser(message => {
				s.message(message)
			})

			let apiKey: string
			if (result.pendingAuthenticationToken) {
				s.stop("Email verification required")
				const code = await p.text({
					message:
						"Check your email for a verification code and enter it here:",
					validate(value) {
						if (!value.trim()) return "Verification code cannot be empty"
					},
				})
				if (p.isCancel(code)) {
					p.cancel("Setup cancelled")
					process.exit(0)
				}
				s.start("Verifying...")
				apiKey = await verifyEmailAndExchange(
					result.pendingAuthenticationToken,
					code,
					result.githubToken,
				)
			} else {
				apiKey = await exchangeForApiKey({
					refreshToken: result.refreshToken,
					...(result.githubToken && {
						githubToken: result.githubToken,
					}),
				})
			}

			saveConfig({ apiKey })
			s.stop("Authenticated with Flamecast")
		} catch (err) {
			s.stop("Authentication failed")
			p.log.error(err instanceof Error ? err.message : "Authentication failed")
			process.exit(1)
		}

		// Step 2: Get GitHub username
		const user = await client.github.user()
		username = user.login

		// Step 3: Claude Code
		const hasClaude = detectClaudeCode()
		if (hasClaude) {
			p.log.success("Claude Code: found")
		} else {
			p.log.warning(
				"Claude Code not found. Install it: npm install -g @anthropic-ai/claude-code",
			)
		}
	}

	// ── New cast member ──────────────────────────────

	p.log.step(
		"\u2500\u2500 New cast member \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
	)

	const defaultName = generateEmployeeName()
	const name = await p.text({
		message: "Name",
		placeholder: defaultName,
		defaultValue: defaultName,
		validate(value) {
			if (!value.trim()) return
			if (!/^[a-z][a-z0-9-]*$/.test(value))
				return "Use lowercase letters, numbers, and hyphens (must start with a letter)"
		},
	})
	if (p.isCancel(name)) {
		p.cancel("Cancelled")
		process.exit(0)
	}

	const jobDescription = await p.text({
		message: "What's their job?",
		placeholder: "triage my email and draft responses for urgent items",
		validate(value) {
			if (!value.trim())
				return "Please describe what this cast member should do"
		},
	})
	if (p.isCancel(jobDescription)) {
		p.cancel("Cancelled")
		process.exit(0)
	}

	// ── Tools ─────────────────────────────────────────

	p.log.step(
		"\u2500\u2500 Tools \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
	)

	const localConfig = discoverLocalConfig()
	let selectedTools: string[] = []

	if (localConfig.mcpServers.length > 0) {
		p.log.info(
			`Found .claude/ config with ${localConfig.mcpServers.length} MCP servers.`,
		)

		const toolOptions = localConfig.mcpServers.map((server: McpServerInfo) => ({
			value: server.name,
			label: server.portable
				? server.name
				: `${server.name}  \u26A0 not portable`,
			hint: server.portable ? undefined : "may not work in CI",
		}))

		const chosen = await p.multiselect({
			message: `Which tools should ${name} have?`,
			options: toolOptions,
			initialValues: localConfig.mcpServers
				.filter((s: McpServerInfo) => s.portable)
				.map((s: McpServerInfo) => s.name),
			required: false,
		})

		if (p.isCancel(chosen)) {
			p.cancel("Cancelled")
			process.exit(0)
		}

		selectedTools = chosen as string[]
	} else {
		p.log.info("No local .claude/ config found. Skipping tool selection.")
	}

	// ── Creating ──────────────────────────────────────

	p.log.step(
		`\u2500\u2500 Creating ${name} \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,
	)

	const systemPrompt = generateSystemPrompt(
		name,
		jobDescription,
		selectedTools,
		localConfig.claudeMd,
	)

	const s3 = p.spinner()
	s3.start(`Creating ${username}/${`flamecast-${name}`}`)

	let workspaceId: string
	let githubRepo: string
	try {
		const workspace = await client.workspaces.create({
			name,
			systemPrompt,
			tools: selectedTools,
		})
		workspaceId = workspace.id
		githubRepo = workspace.githubRepo
		s3.stop(`Created ${username}/flamecast-${name}`)
	} catch (err) {
		s3.stop("Failed to create workspace")
		p.log.error(err instanceof Error ? err.message : "Unknown error")
		process.exit(1)
	}

	p.log.success("Workflow installed")
	if (selectedTools.length > 0) {
		p.log.success(`Tools configured: ${selectedTools.join(", ")}`)
	}
	p.log.success("Job description \u2192 system prompt")

	const secretsUrl = `https://github.com/${githubRepo}/settings/secrets/actions`
	p.log.info(`Secrets: ${secretsUrl}`)

	// ── Secrets ──────────────────────────────────────

	p.log.step(
		"\u2500\u2500 Secrets \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
	)

	// GitHub PAT
	const githubPat = await promptGitHubPat(name, githubRepo)
	if (githubPat) {
		const s4 = p.spinner()
		s4.start(`Storing FLAMECAST_PAT to GitHub (${secretsUrl})...`)
		try {
			await client.workspaces.secrets.set(workspaceId, {
				secrets: { FLAMECAST_PAT: githubPat },
			})
			s4.stop(`FLAMECAST_PAT stored \u2192 ${secretsUrl}`)
		} catch (err) {
			s4.stop("Failed to store FLAMECAST_PAT")
			p.log.error(err instanceof Error ? err.message : "Unknown error")
		}
	}

	// Claude Code token
	const claudeToken = await promptClaudeToken()
	if (claudeToken) {
		const s5 = p.spinner()
		s5.start("Storing CLAUDE_CODE_OAUTH_TOKEN...")
		try {
			await client.workspaces.secrets.set(workspaceId, {
				secrets: { CLAUDE_CODE_OAUTH_TOKEN: claudeToken },
			})
			s5.stop(`CLAUDE_CODE_OAUTH_TOKEN stored \u2192 ${secretsUrl}`)
		} catch (err) {
			s5.stop("Failed to store CLAUDE_CODE_OAUTH_TOKEN")
			p.log.error(err instanceof Error ? err.message : "Unknown error")
		}
	}

	// ── First task ────────────────────────────────────

	const firstTask = await p.text({
		message: `${name} is ready at https://github.com/${githubRepo}. Give them something to do:`,
		placeholder: "triage my inbox from the last 24 hours, flag anything urgent",
	})

	if (p.isCancel(firstTask) || !firstTask || !firstTask.trim()) {
		p.outro(
			`\u{1F525} ${name} is ready. Run \`flame run ${name} <prompt>\` to dispatch a task.`,
		)
		return
	}

	const s6 = p.spinner()
	s6.start("Dispatching task...")
	try {
		const task = await client.workspaces.tasks.create(workspaceId, {
			prompt: firstTask.trim(),
		})
		const workflowUrl = `https://github.com/${githubRepo}/actions/runs/${task.id}`
		s6.stop(`Task dispatched \u2192 ${workflowUrl}`)

		let taskGetCommand = `flame task get ${task.id}`
		try {
			const { defaultWorkspaceId } = await client.workspaces.default.get()
			if (defaultWorkspaceId !== workspaceId) {
				taskGetCommand += ` --workspace ${workspaceId}`
			}
		} catch {
			// Fall back to explicit workspace if we can't resolve the default.
			taskGetCommand += ` --workspace ${workspaceId}`
		}

		p.outro(`\u{1F525} Run \`${taskGetCommand}\` to check in.`)
	} catch (err) {
		s6.stop("Failed to dispatch task")
		p.log.error(err instanceof Error ? err.message : "Unknown error")
		p.outro(
			`\u{1F525} ${name} is ready. Run \`flame run ${name} <prompt>\` to dispatch a task.`,
		)
	}
}

/**
 * Run `claude setup-token` interactively and ask the user to paste the token.
 */
async function promptClaudeToken(): Promise<string | null> {
	const hasClaude = detectClaudeCode()
	if (!hasClaude) {
		p.log.warning(
			"Claude Code not found. Install it: npm install -g @anthropic-ai/claude-code",
		)
		return null
	}

	p.log.message(
		"We also need a Claude Code OAuth token so your cast member can use Claude.",
	)

	const proceed = await p.confirm({
		message: "Press Enter to set up Claude Code token...",
		initialValue: true,
	})

	if (p.isCancel(proceed)) {
		return null
	}

	const result = spawnSync("claude", ["setup-token"], {
		stdio: "inherit",
		timeout: 120_000,
	})

	if (result.status !== 0) {
		p.log.warning(
			"Could not provision token. Run `flame setup-claude` to set it up manually.",
		)
		return null
	}

	p.log.info("Copy the token from the output above (starts with sk-ant-).")

	const token = await p.text({
		message: "Paste the token here:",
		validate(value) {
			if (!value.trim()) return "Token cannot be empty"
			if (!value.trim().startsWith("sk-ant-"))
				return "Token should start with sk-ant-"
		},
	})

	if (p.isCancel(token)) {
		return null
	}

	return token.trim()
}

/**
 * Prompt the user to generate a GitHub PAT and paste it in.
 */
async function promptGitHubPat(
	name: string,
	githubRepo: string,
): Promise<string | null> {
	p.log.message(
		"To access your GitHub repositories on your behalf, we need a GitHub Personal Access Token.\n" +
			"**We do not store this anywhere** \u2014 it is safe and read-only within your GitHub Secrets\n" +
			`View your GitHub Secrets: https://github.com/${githubRepo}/settings/secrets/actions`,
	)

	const tokenUrl = `https://github.com/settings/tokens/new?scopes=workflow,repo&description=flamecast-${name}`

	const proceed = await p.confirm({
		message: "Press Enter to open GitHub and generate a token...",
		initialValue: true,
	})

	if (p.isCancel(proceed)) {
		p.cancel("Setup cancelled")
		process.exit(0)
	}

	openBrowser(tokenUrl)

	const token = await p.text({
		message: "Paste the token here:",
		validate(value) {
			if (!value.trim()) return "Token cannot be empty"
			if (
				!value.trim().startsWith("ghp_") &&
				!value.trim().startsWith("github_pat_")
			)
				return "Token should start with ghp_ or github_pat_"
		},
	})

	if (p.isCancel(token)) {
		return null
	}

	return token.trim()
}

function generateSystemPrompt(
	name: string,
	jobDescription: string,
	tools: string[],
	existingClaudeMd: string | null,
) {
	const lines: string[] = []

	lines.push(`# ${name}`)
	lines.push("")
	lines.push(`## Role`)
	lines.push("")
	lines.push(jobDescription)
	lines.push("")

	if (tools.length > 0) {
		lines.push(`## Available Tools`)
		lines.push("")
		for (const tool of tools) {
			lines.push(`- ${tool}`)
		}
		lines.push("")
	}

	if (existingClaudeMd) {
		lines.push(`## Additional Context`)
		lines.push("")
		lines.push(existingClaudeMd)
	}

	return lines.join("\n")
}
