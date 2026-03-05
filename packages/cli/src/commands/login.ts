import * as p from "@clack/prompts"
import { saveConfig } from "../lib/config.js"
import {
	authenticateViaBrowser,
	verifyEmailAndExchange,
	exchangeForApiKey,
} from "../lib/auth.js"

export async function handleLogin() {
	const s = p.spinner()
	s.start("Starting authentication...")

	try {
		const result = await authenticateViaBrowser(message => {
			s.message(message)
		})

		let apiKey: string
		if (result.pendingAuthenticationToken) {
			s.stop("Email verification required")
			const code = await p.text({
				message: "Check your email for a verification code and enter it here:",
				validate(value) {
					if (!value.trim()) return "Verification code cannot be empty"
				},
			})
			if (p.isCancel(code)) {
				p.cancel("Login cancelled")
				process.exit(0)
			}

			s.start("Verifying...")
			apiKey = await verifyEmailAndExchange(
				result.pendingAuthenticationToken,
				code,
				result.githubToken,
			)
		} else {
			apiKey = await exchangeForApiKey({
				refreshToken: result.refreshToken,
				...(result.githubToken && { githubToken: result.githubToken }),
			})
		}

		saveConfig({ apiKey })
		s.stop("Logged in")
	} catch (err) {
		s.stop("Login failed")
		p.log.error(err instanceof Error ? err.message : "Login failed")
		process.exit(1)
	}
}
