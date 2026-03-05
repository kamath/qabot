import * as p from "@clack/prompts"
import { spawnSync } from "node:child_process"
import { detectClaudeCode } from "../lib/detect.js"
import { loadConfig, saveConfig } from "../lib/config.js"

export async function handleSetupClaude() {
	if (!detectClaudeCode()) {
		p.log.error(
			"Claude Code CLI not found. Install it: npm install -g @anthropic-ai/claude-code",
		)
		process.exit(1)
	}

	// Let claude setup-token fully own the terminal so the user sees
	// the output rendered correctly (it uses cursor positioning, etc.)
	const result = spawnSync("claude", ["setup-token"], {
		stdio: "inherit",
		timeout: 120_000,
	})

	// Show our UI after the subprocess exits so screen clears don't wipe it
	p.intro("Set up Claude Code token")

	if (result.status !== 0) {
		p.log.error("`claude setup-token` failed. Please try again.")
		process.exit(1)
	}

	p.log.info("Copy the token from the output above (starts with sk-ant-).")

	const token = await p.text({
		message: "Paste the token here:",
		validate(value) {
			const cleaned = value.replace(/[\r\n]/g, "").trim()
			if (!cleaned) return "Token cannot be empty"
			if (!cleaned.startsWith("sk-ant-"))
				return "Token should start with sk-ant-"
		},
	})

	if (p.isCancel(token)) {
		p.cancel("Cancelled")
		process.exit(0)
	}

	const config = loadConfig()
	if (config) {
		saveConfig({ ...config, claudeToken: token.replace(/[\r\n]/g, "").trim() })
	} else {
		p.log.warning(
			"Not logged in yet. Run `flame login` first, then re-run `flame setup-claude`.",
		)
		process.exit(1)
	}

	p.outro("Claude Code token saved")
}
