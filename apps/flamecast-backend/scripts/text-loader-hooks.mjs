/**
 * ESM loader hooks that resolve .yml and .md imports as text modules.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const TEXT_EXTENSIONS = [".yml", ".yaml", ".md", ".flamecast"]

export async function load(url, context, nextLoad) {
	if (TEXT_EXTENSIONS.some(ext => url.endsWith(ext))) {
		const filePath = fileURLToPath(url)
		const content = readFileSync(filePath, "utf-8")
		return {
			format: "module",
			source: `export default ${JSON.stringify(content)};`,
			shortCircuit: true,
		}
	}
	return nextLoad(url, context)
}
