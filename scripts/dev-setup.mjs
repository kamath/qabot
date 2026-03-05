import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const BACKEND_URL = "http://localhost:6970"

function upsertEnv(filePath, key, value) {
	let content = ""
	if (existsSync(filePath)) {
		content = readFileSync(filePath, "utf-8")
	}

	const line = `${key}=${value}`
	const regex = new RegExp(`^${key}=.*$`, "m")

	if (regex.test(content)) {
		content = content.replace(regex, line)
	} else {
		content = `${content.trimEnd() + (content.length > 0 ? "\n" : "") + line}\n`
	}

	writeFileSync(filePath, content)
}

upsertEnv(resolve(root, ".env"), "FLAMECAST_BASE_URL", BACKEND_URL)
upsertEnv(resolve(root, "packages/cli/.env"), "FLAMECAST_BASE_URL", BACKEND_URL)

console.log(`Dev env configured: FLAMECAST_BASE_URL=${BACKEND_URL}`)
