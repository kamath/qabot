#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

// Injected at compile time by scripts/compile.ts via --define
declare const __FLAME_VERSION__: string | undefined

function getVersion(): string {
	if (typeof __FLAME_VERSION__ !== "undefined") return __FLAME_VERSION__
	try {
		const dir = dirname(fileURLToPath(import.meta.url))
		const pkg = JSON.parse(
			readFileSync(resolve(dir, "..", "package.json"), "utf-8"),
		)
		return pkg.version
	} catch {
		return "unknown"
	}
}

// Load .env from the CLI package root, but only in dev (cli:local sets
// FLAMECAST_BASE_URL as a real env var; the .env file is for local dev only).
if (process.env.NODE_ENV === "development") {
	const __cli_dir = dirname(fileURLToPath(import.meta.url))
	const envPath = resolve(__cli_dir, "..", ".env")
	if (existsSync(envPath)) {
		for (const line of readFileSync(envPath, "utf-8").split("\n")) {
			const match = line.match(/^([^#=]+)=(.*)$/)
			if (match && !process.env[match[1]]) {
				process.env[match[1]] = match[2]
			}
		}
	}
}

const backendUrl =
	process.env.FLAMECAST_BASE_URL ||
	process.env.BACKEND_URL ||
	process.env.BACKEND_BASE_URL ||
	"http://localhost:6970/api"
if (backendUrl.includes("localhost")) {
	const workosClientId =
		process.env.WORKOS_CLIENT_ID ?? "client_01KD3FTW7R2QD0NW6QB7QP6Q0B"
	console.log(`dev mode: ${backendUrl} ${workosClientId}`)
}

import { Command } from "commander"
import { APIError } from "@flamecast/api"

const program = new Command()
	.name("flame")
	.version(getVersion())
	.description("Flamecast CLI")

// ── workspace | ws | cast ──────────────────────────

function registerWorkspaceCommands(cmd: Command) {
	cmd
		.command("create")
		.alias("c")
		.alias("add")
		.description("Create a new workspace (interactive)")
		.action(async () => {
			const { handleWorkspaceCreate } = await import(
				"./commands/workspace/create.js"
			)
			await handleWorkspaceCreate()
		})

	cmd
		.command("list")
		.alias("ls")
		.description("List all workspaces")
		.action(async () => {
			const { handleWorkspaceList } = await import(
				"./commands/workspace/list.js"
			)
			await handleWorkspaceList()
		})

	// Default action when no subcommand — show list
	cmd.action(async () => {
		const { handleWorkspaceList } = await import("./commands/workspace/list.js")
		await handleWorkspaceList()
	})

	cmd
		.command("get <ref>")
		.alias("g")
		.description("Get workspace details by name or ID")
		.action(async (ref: string) => {
			const { handleWorkspaceGet } = await import("./commands/workspace/get.js")
			await handleWorkspaceGet(ref)
		})

	cmd
		.command("delete <ref>")
		.alias("rm")
		.description("Delete a workspace")
		.action(async (ref: string) => {
			const { handleWorkspaceDelete } = await import(
				"./commands/workspace/delete.js"
			)
			await handleWorkspaceDelete(ref)
		})

	cmd
		.command("set-default <ref>")
		.description("Set the default workspace")
		.action(async (ref: string) => {
			const { handleWorkspaceSetDefault } = await import(
				"./commands/workspace/set-default.js"
			)
			await handleWorkspaceSetDefault(ref)
		})

	cmd
		.command("set-secrets <ref> [secrets...]")
		.description("Set secrets on a workspace (KEY=VALUE ...)")
		.action(async (ref: string, secrets: string[]) => {
			const { handleWorkspaceSetSecrets } = await import(
				"./commands/workspace/set-secrets.js"
			)
			await handleWorkspaceSetSecrets(ref, secrets)
		})

	cmd
		.command("sync <ref>")
		.alias("sync-workflows")
		.description("Sync workflow files to the workspace repo")
		.action(async (ref: string) => {
			const { handleWorkspaceSyncWorkflows } = await import(
				"./commands/workspace/sync-workflows.js"
			)
			await handleWorkspaceSyncWorkflows(ref)
		})
}

const workspaceCmd = program
	.command("workspace")
	.alias("ws")
	.description("Manage workspaces")
registerWorkspaceCommands(workspaceCmd)

// "cast" as a top-level alias for "workspace"
const castCmd = program
	.command("cast")
	.description("Manage workspaces (alias for workspace)")
registerWorkspaceCommands(castCmd)

// ── task | t ───────────────────────────────────────

const taskCmd = program.command("task").alias("t").description("Manage tasks")

taskCmd
	.command("create <prompt...>")
	.alias("c")
	.description("Create a new task")
	.option(
		"-w, --workspace <ref>",
		"Workspace name or ID (default: default workspace)",
	)
	.action(async (prompt: string[], opts: { workspace?: string }) => {
		const { handleTaskCreate } = await import("./commands/task/create.js")
		await handleTaskCreate(prompt, opts.workspace)
	})

taskCmd
	.command("list")
	.alias("ls")
	.description("List tasks for a workspace")
	.option(
		"-w, --workspace <ref>",
		"Workspace name or ID (default: default workspace)",
	)
	.option("-a, --all", "List across all workspaces")
	.action(async (opts: { workspace?: string; all?: boolean }) => {
		const { handleTaskList } = await import("./commands/task/list.js")
		await handleTaskList(opts)
	})

// Default action when no subcommand — show list
taskCmd.action(async () => {
	const { handleTaskList } = await import("./commands/task/list.js")
	await handleTaskList({})
})

taskCmd
	.command("get <taskId>")
	.alias("g")
	.description("Get task details")
	.option(
		"-w, --workspace <ref>",
		"Workspace name or ID (default: default workspace)",
	)
	.action(async (taskId: string, opts: { workspace?: string }) => {
		const { handleTaskGet } = await import("./commands/task/get.js")
		await handleTaskGet(taskId, opts.workspace)
	})

// ── mcp ─────────────────────────────────────────────

const mcpCmd = program
	.command("mcp")
	.description("Manage MCP server connections")

mcpCmd
	.command("add <server>")
	.description("Add an MCP server connection (slug or URL)")
	.option(
		"-w, --workspace <ref>",
		"Workspace name or ID (default: default workspace)",
	)
	.action(async (server: string, opts: { workspace?: string }) => {
		const { handleMcpAdd } = await import("./commands/mcp/add.js")
		await handleMcpAdd(server, opts)
	})

mcpCmd
	.command("list")
	.alias("ls")
	.description("List MCP connections for a workspace")
	.option(
		"-w, --workspace <ref>",
		"Workspace name or ID (default: default workspace)",
	)
	.option("-a, --all", "List across all workspaces")
	.action(async (opts: { workspace?: string; all?: boolean }) => {
		const { handleMcpList } = await import("./commands/mcp/list.js")
		await handleMcpList(opts)
	})

mcpCmd
	.command("remove <server>")
	.alias("rm")
	.description("Remove an MCP connection")
	.option(
		"-w, --workspace <ref>",
		"Workspace name or ID (default: default workspace)",
	)
	.action(async (server: string, opts: { workspace?: string }) => {
		const { handleMcpRemove } = await import("./commands/mcp/remove.js")
		await handleMcpRemove(server, opts)
	})

// Default action — show list
mcpCmd.action(async () => {
	const { handleMcpList } = await import("./commands/mcp/list.js")
	await handleMcpList({})
})

// ── skill ────────────────────────────────────────────

const skillCmd = program
	.command("skill")
	.description("Manage Claude Code skills")

skillCmd
	.command("add <nameOrUrl>")
	.description("Add a skill from the Smithery registry or a git URL")
	.option(
		"-w, --workspace <ref>",
		"Workspace name or ID (default: default workspace)",
	)
	.action(async (nameOrUrl: string, opts: { workspace?: string }) => {
		const { handleSkillAdd } = await import("./commands/skill/add.js")
		await handleSkillAdd(nameOrUrl, opts)
	})

skillCmd
	.command("list")
	.alias("ls")
	.description("List installed skills for a workspace")
	.option(
		"-w, --workspace <ref>",
		"Workspace name or ID (default: default workspace)",
	)
	.option("-a, --all", "List across all workspaces")
	.action(async (opts: { workspace?: string; all?: boolean }) => {
		const { handleSkillList } = await import("./commands/skill/list.js")
		await handleSkillList(opts)
	})

skillCmd
	.command("remove <name>")
	.alias("rm")
	.description("Remove an installed skill (accepts qualified name or slug)")
	.option(
		"-w, --workspace <ref>",
		"Workspace name or ID (default: default workspace)",
	)
	.action(async (name: string, opts: { workspace?: string }) => {
		const { handleSkillRemove } = await import("./commands/skill/remove.js")
		await handleSkillRemove(name, opts)
	})

// Default action — show list
skillCmd.action(async () => {
	const { handleSkillList } = await import("./commands/skill/list.js")
	await handleSkillList({})
})

// ── top-level commands ─────────────────────────────

program
	.command("login")
	.description("Authenticate with Flamecast")
	.action(async () => {
		const { handleLogin } = await import("./commands/login.js")
		await handleLogin()
	})

program
	.command("logout")
	.description("Clear saved credentials")
	.action(async () => {
		const { handleLogout } = await import("./commands/logout.js")
		await handleLogout()
	})

program
	.command("api")
	.description("Print API key")
	.action(async () => {
		const { handleApi } = await import("./commands/api.js")
		handleApi()
	})

program
	.command("setup-claude")
	.description("Set up Claude Code token")
	.action(async () => {
		const { handleSetupClaude } = await import("./commands/setup-claude.js")
		await handleSetupClaude()
	})

try {
	await program.parseAsync()
} catch (err) {
	if (err instanceof APIError) {
		const body = err.error as { error?: string } | undefined
		console.error(body?.error ?? err.message)
		process.exitCode = 1
	} else {
		throw err
	}
}
