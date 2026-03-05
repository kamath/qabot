import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export interface LocalConfig {
	claudeMd: string | null
	mcpServers: McpServerInfo[]
}

export interface McpServerInfo {
	name: string
	command?: string
	url?: string
	portable: boolean
}

/**
 * Check if Claude Code CLI is installed.
 */
export function detectClaudeCode(): boolean {
	const result = spawnSync("which", ["claude"], { encoding: "utf-8" })
	return result.status === 0
}

const NON_PORTABLE_PATTERNS = [
	"localhost",
	"127.0.0.1",
	"filesystem",
	"/Users/",
	"/home/",
	"file://",
]

function isPortable(server: McpServerInfo) {
	const str = JSON.stringify(server).toLowerCase()
	return !NON_PORTABLE_PATTERNS.some(p => str.includes(p.toLowerCase()))
}

/**
 * Scan .claude/ and .agent/ directories for MCP server configurations.
 */
export function discoverLocalConfig(cwd?: string): LocalConfig {
	const dir = cwd || process.cwd()

	let claudeMd: string | null = null
	const claudeMdPath = join(dir, ".claude", "CLAUDE.md")
	if (existsSync(claudeMdPath)) {
		try {
			claudeMd = readFileSync(claudeMdPath, "utf-8")
		} catch {
			// ignore
		}
	}

	const mcpServers: McpServerInfo[] = []

	// Check .claude/settings.json for MCP servers
	const settingsPath = join(dir, ".claude", "settings.json")
	if (existsSync(settingsPath)) {
		try {
			const settings = JSON.parse(readFileSync(settingsPath, "utf-8"))
			if (settings.mcpServers && typeof settings.mcpServers === "object") {
				for (const [name, config] of Object.entries(
					settings.mcpServers as Record<string, unknown>,
				)) {
					const cfg = config as Record<string, unknown>
					const server: McpServerInfo = {
						name,
						command: cfg.command as string | undefined,
						url: cfg.url as string | undefined,
						portable: true,
					}
					server.portable = isPortable(server)
					mcpServers.push(server)
				}
			}
		} catch {
			// ignore parse errors
		}
	}

	// Check .claude/settings.local.json
	const localSettingsPath = join(dir, ".claude", "settings.local.json")
	if (existsSync(localSettingsPath)) {
		try {
			const settings = JSON.parse(readFileSync(localSettingsPath, "utf-8"))
			if (settings.mcpServers && typeof settings.mcpServers === "object") {
				for (const [name, config] of Object.entries(
					settings.mcpServers as Record<string, unknown>,
				)) {
					if (mcpServers.some(s => s.name === name)) continue
					const cfg = config as Record<string, unknown>
					const server: McpServerInfo = {
						name,
						command: cfg.command as string | undefined,
						url: cfg.url as string | undefined,
						portable: true,
					}
					server.portable = isPortable(server)
					mcpServers.push(server)
				}
			}
		} catch {
			// ignore
		}
	}

	return { claudeMd, mcpServers }
}
