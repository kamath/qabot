import { createWorkOS } from "@workos-inc/node"
import { openBrowser } from "./open-browser.js"
import { loadConfig, saveConfig } from "./config.js"
import { startCallbackServer } from "./callback-server.js"
import Flamecast from "@flamecast/api"
import * as dotenv from "dotenv"

dotenv.config()

const WORKOS_CLIENT_ID =
	process.env.WORKOS_CLIENT_ID ?? "client_01KD3FTW7R2QD0NW6QB7QP6Q0B"

export const FLAMECAST_BASE_URL =
	process.env.FLAMECAST_BASE_URL ||
	process.env.BACKEND_BASE_URL ||
	process.env.BACKEND_URL ||
	"http://localhost:6970/api"

const workos = createWorkOS({ clientId: WORKOS_CLIENT_ID })

interface AuthResult {
	refreshToken: string
	githubToken?: string
	pendingAuthenticationToken?: string
}

const SANITY_URL = `${FLAMECAST_BASE_URL.replace(/\/+$/, "")}/sanity`

/**
 * Authenticates via WorkOS Authorization Code flow with PKCE.
 *
 * 1. Start a local callback server
 * 2. Generate authorization URL with PKCE
 * 3. Open browser to WorkOS/GitHub auth
 * 4. Receive callback with authorization code
 * 5. Exchange code for tokens (includes GitHub OAuth token)
 * 6. If email verification is required, return the pending token
 * 7. Otherwise exchange WorkOS refresh token for a Flamecast API key
 */
export async function authenticateViaBrowser(
	onStatus?: (message: string) => void,
): Promise<AuthResult> {
	const { redirectUri, waitForCallback, close } = await startCallbackServer()

	try {
		// Generate PKCE authorization URL
		const { url, state, codeVerifier } =
			await workos.userManagement.getAuthorizationUrlWithPKCE({
				provider: "GitHubOAuth",
				redirectUri,
				providerScopes: ["repo", "read:user"],
			})

		onStatus?.("Opening browser for authentication...")
		openBrowser(url)

		// Wait for the OAuth callback
		onStatus?.("Waiting for browser authentication...")
		const callback = await waitForCallback()

		if (callback.state !== state) {
			throw new Error("OAuth state mismatch")
		}

		// Exchange code for tokens — this returns oauthTokens (GitHub token)
		try {
			const authResult =
				await workos.userManagement.authenticateWithCodeAndVerifier({
					code: callback.code,
					codeVerifier,
				})

			return {
				refreshToken: authResult.refreshToken,
				githubToken: authResult.oauthTokens?.accessToken,
			}
		} catch (err: unknown) {
			// WorkOS requires email verification — extract the pending token
			const rawData = (err as { rawData?: Record<string, unknown> })?.rawData
			const pendingToken = rawData?.pending_authentication_token as
				| string
				| undefined
			if (!pendingToken) throw err

			return { refreshToken: "", pendingAuthenticationToken: pendingToken }
		}
	} finally {
		close()
	}
}

export async function exchangeForApiKey(
	body: Record<string, string>,
): Promise<string> {
	const res = await fetch(`${FLAMECAST_BASE_URL}/auth/cli/exchange`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	})

	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Failed to exchange token: ${text}`)
	}

	const { apiKey } = (await res.json()) as { apiKey: string }
	return apiKey
}

export async function verifyEmailAndExchange(
	pendingAuthenticationToken: string,
	verificationCode: string,
	githubToken?: string,
): Promise<string> {
	const body: Record<string, string> = {
		pendingAuthenticationToken,
		code: verificationCode,
	}
	if (githubToken) body.githubToken = githubToken

	const res = await fetch(`${FLAMECAST_BASE_URL}/auth/cli/verify-email`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	})

	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Email verification failed: ${text}`)
	}

	const { apiKey } = (await res.json()) as { apiKey: string }
	return apiKey
}

/**
 * Ensures the user is authenticated. Returns a valid API key.
 * Uses backend sanity check for validation. No auth exchange is performed here.
 */
export async function ensureAuthenticated() {
	const config = loadConfig()
	if (config?.apiKey) {
		const sanityRes = await fetch(SANITY_URL)
		if (sanityRes.ok) {
			return { apiKey: config.apiKey }
		}
		console.warn("Key or base URL is invalid, re-authenticating...")
		throw new Error("Backend returned non-ok from sanity check")
	}

	const sanityRes = await fetch(SANITY_URL)
	if (!sanityRes.ok) {
		throw new Error(
			`Backend sanity check failed with status ${sanityRes.status}`,
		)
	}

	throw new Error(
		"API key not configured. This CLI is in sanity-check mode and does not perform auth token exchange.",
	)
}

export const getFlamecastApiKey = async () => {
	const { apiKey } = await ensureAuthenticated()
	return apiKey
}

export const client = new Flamecast({
	apiKey: await getFlamecastApiKey(),
	baseURL: FLAMECAST_BASE_URL,
})
