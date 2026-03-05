import { execSync } from "node:child_process"

export function openBrowser(url: string) {
	const cmd =
		process.platform === "darwin"
			? "open"
			: process.platform === "win32"
				? "start"
				: "xdg-open"

	try {
		execSync(`${cmd} ${JSON.stringify(url)}`, { stdio: "ignore" })
	} catch {
		console.log(`Open this URL in your browser: ${url}`)
	}
}
