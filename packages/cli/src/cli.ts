#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

if (process.env.NODE_ENV === "development") {
	const cliDir = dirname(fileURLToPath(import.meta.url))
	const envPath = resolve(cliDir, "..", ".env")
	if (existsSync(envPath)) {
		for (const line of readFileSync(envPath, "utf-8").split("\n")) {
			const match = line.match(/^([^#=]+)=(.*)$/)
			if (match && !process.env[match[1]]) {
				process.env[match[1]] = match[2]
			}
		}
	}
}

const defaultBaseUrl =
	process.env.FLAMECAST_BASE_URL ||
	process.env.BACKEND_URL ||
	process.env.BACKEND_BASE_URL ||
	"http://localhost:6970/api"
const backendUrl = defaultBaseUrl.replace(/\/+$/, "")
const sanityUrl = `${backendUrl}/sanity`

try {
	const response = await fetch(sanityUrl)
	const json = await response.json().catch(() => null)

	if (!response.ok) {
		console.error(`Sanity check failed: ${response.status}`)
		if (json) console.error(JSON.stringify(json))
		process.exit(1)
	}

	console.log(`Sanity check OK: ${sanityUrl}`)
	console.log(json ? JSON.stringify(json, null, 2) : "No JSON payload")
} catch (error) {
	console.error("Sanity check request failed:", error)
	process.exit(1)
}
