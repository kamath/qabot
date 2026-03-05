import { loadConfig } from "../lib/config.js"

export function handleApi() {
	const config = loadConfig()
	if (!config?.apiKey) {
		console.error("No API key found. Run `flame` to authenticate first.")
		process.exit(1)
	}

	process.stdout.write(config.apiKey)
}
