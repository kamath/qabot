import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

export interface FlamecastConfig {
	apiKey: string
	apiUrl?: string
	claudeToken?: string
}

function getConfigDir() {
	const xdg = process.env.XDG_CONFIG_HOME
	const base = xdg || join(homedir(), ".config")
	return join(base, "flamecast")
}

function getConfigPath() {
	return join(getConfigDir(), "config.json")
}

export function loadConfig(): FlamecastConfig | null {
	const path = getConfigPath()
	if (!existsSync(path)) return null
	try {
		const raw = readFileSync(path, "utf-8")
		const parsed = JSON.parse(raw)
		if (typeof parsed.apiKey !== "string") return null
		return parsed as FlamecastConfig
	} catch {
		return null
	}
}

export function saveConfig(config: FlamecastConfig) {
	const dir = getConfigDir()
	mkdirSync(dir, { recursive: true, mode: 0o700 })
	const path = getConfigPath()
	writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, {
		mode: 0o600,
	})
}

export function clearConfig() {
	const path = getConfigPath()
	if (existsSync(path)) {
		writeFileSync(path, "{}\n", { mode: 0o600 })
	}
}
