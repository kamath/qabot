/**
 * Offline OpenAPI spec generation script.
 *
 * Generates the OpenAPI spec by importing the Hono app and using
 * hono-openapi's route introspection. No HTTP server is started.
 *
 * Usage: pnpm run openapi:generate
 * Output: openapi.json in the apps/flamecast-backend directory
 */
import { writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { generateSpecs } from "hono-openapi"
import {
	injectSchemas,
	markAmbiguousAdditionalProperties,
} from "@flamecast/utils/openapi"
import { app } from "../src/index.js"
import { openAPIDocumentation } from "../src/openapi.js"
import { allSchemas } from "@flamecast/api-schemas"

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
	console.log("Generating OpenAPI spec...")

	const spec = await generateSpecs(app, {
		documentation: openAPIDocumentation,
	})

	const result = spec as Record<string, unknown>

	injectSchemas(result, allSchemas)
	markAmbiguousAdditionalProperties(result)

	const outputPath = resolve(__dirname, "..", "openapi.json")
	writeFileSync(outputPath, JSON.stringify(result, null, 2))

	const paths = result.paths as Record<string, unknown> | undefined
	console.log(`OpenAPI spec generated: ${outputPath}`)
	console.log(`  Paths: ${paths ? Object.keys(paths).length : 0}`)
}

main().catch(err => {
	console.error("Failed to generate OpenAPI spec:", err)
	process.exit(1)
})
