import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const TEMPLATE_ENV_FILES = [".env.example", ".dev.vars.example"]
const LOCAL_ENV_FILES = [".env", ".env.local", ".dev.vars", ".dev.vars.local"]

function hasAssignments(filePath) {
	if (!existsSync(filePath)) {
		return false
	}

	const content = readFileSync(filePath, "utf8")
	return content.split(/\r?\n/).some(line => {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith("#")) {
			return false
		}

		return /^(export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=/.test(trimmed)
	})
}

function getPopulatedEnvFiles(files) {
	return files.filter(name => hasAssignments(resolve(process.cwd(), name)))
}

const templateEnvFiles = getPopulatedEnvFiles(TEMPLATE_ENV_FILES)
const localEnvFiles = getPopulatedEnvFiles(LOCAL_ENV_FILES)
const envFiles = templateEnvFiles.length > 0 ? templateEnvFiles : localEnvFiles

if (envFiles.length === 0) {
	// In CI/fresh clones without secrets, avoid clobbering committed worker types.
	console.log(
		"[cf-typegen] Skipping: no populated .env.example/.dev.vars.example or local .env/.dev.vars file found. Keeping committed worker-configuration.d.ts.",
	)
	process.exit(0)
}

const result = spawnSync(
	"wrangler",
	[
		"types",
		"--env-interface",
		"CloudflareBindings",
		...envFiles.flatMap(file => ["--env-file", file]),
	],
	{
		stdio: "inherit",
		shell: process.platform === "win32",
	},
)

if (result.error) {
	console.error(`[cf-typegen] Failed to run wrangler: ${result.error.message}`)
	process.exit(1)
}

process.exit(result.status ?? 1)
