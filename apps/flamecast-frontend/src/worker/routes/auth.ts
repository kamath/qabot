import { Hono } from "hono"
import { getCookie, setCookie, deleteCookie } from "hono/cookie"
import { z } from "zod"
import { validator as zValidator } from "hono-openapi"
import { WorkOS } from "@workos-inc/node"
import { githubOauthTokens } from "@flamecast/db/schema"
import { createDbFromUrl } from "@flamecast/db"
import { ensurePersonalOrganization } from "@flamecast/auth"
import { authMiddleware, type AuthEnv } from "@flamecast/auth"

const ExchangeRequestSchema = z.object({
	refreshToken: z.string(),
	githubToken: z.string().optional(),
})

const VerifyEmailRequestSchema = z.object({
	pendingAuthenticationToken: z.string(),
	code: z.string(),
	githubToken: z.string().optional(),
})

// ── Lightweight auth validation (no DB workspace queries) ──

const check = new Hono<AuthEnv<Cloudflare.Env>>()
	.use(authMiddleware)
	.get("/", async c => {
		return c.json({ ok: true })
	})

// ── CLI auth: exchange WorkOS refresh token for WorkOS API key ──

const auth = new Hono<{ Bindings: Cloudflare.Env }>()
	.route("/check", check)
	.post("/cli/exchange", zValidator("json", ExchangeRequestSchema), async c => {
		const { refreshToken, githubToken } = c.req.valid("json")

		const workos = new WorkOS(c.env.WORKOS_API_KEY, {
			clientId: c.env.WORKOS_CLIENT_ID,
		})

		let userId: string
		let userEmail: string
		let oauthAccessToken: string | undefined
		try {
			const result = await workos.userManagement.authenticateWithRefreshToken({
				refreshToken,
				clientId: c.env.WORKOS_CLIENT_ID,
			})
			userId = result.user.id
			userEmail = result.user.email
			oauthAccessToken = result.oauthTokens?.accessToken
		} catch {
			return c.json({ error: "Invalid or expired token" }, 401)
		}

		const db = createDbFromUrl(c.env.HYPERDRIVE.connectionString)

		// Store GitHub token — prefer explicit token from request, fall back to WorkOS OAuth token
		const tokenToStore = githubToken ?? oauthAccessToken
		if (tokenToStore) {
			await db
				.insert(githubOauthTokens)
				.values({
					userId,
					accessToken: tokenToStore,
					scopes: [],
				})
				.onConflictDoUpdate({
					target: githubOauthTokens.userId,
					set: { accessToken: tokenToStore },
				})
		}

		const organizationId = await ensurePersonalOrganization(
			workos,
			db,
			userId,
			userEmail,
		)

		const key = await workos.organizations.createOrganizationApiKey({
			organizationId,
			name: "CLI",
		})

		return c.json({ apiKey: key.value })
	})
	.post(
		"/cli/verify-email",
		zValidator("json", VerifyEmailRequestSchema),
		async c => {
			const { pendingAuthenticationToken, code, githubToken } =
				c.req.valid("json")

			const workos = new WorkOS(c.env.WORKOS_API_KEY, {
				clientId: c.env.WORKOS_CLIENT_ID,
			})

			const result = await workos.userManagement
				.authenticateWithEmailVerification({
					pendingAuthenticationToken,
					code,
					clientId: c.env.WORKOS_CLIENT_ID,
				})
				.catch(() => null)
			if (!result) {
				return c.json({ error: "Invalid or expired verification code" }, 401)
			}

			const userId = result.user.id
			const userEmail = result.user.email
			const db = createDbFromUrl(c.env.HYPERDRIVE.connectionString)

			const tokenToStore = githubToken ?? result.oauthTokens?.accessToken
			if (tokenToStore) {
				await db
					.insert(githubOauthTokens)
					.values({
						userId,
						accessToken: tokenToStore,
						scopes: [],
					})
					.onConflictDoUpdate({
						target: githubOauthTokens.userId,
						set: { accessToken: tokenToStore },
					})
			}

			const organizationId = await ensurePersonalOrganization(
				workos,
				db,
				userId,
				userEmail,
			)

			const key = await workos.organizations.createOrganizationApiKey({
				organizationId,
				name: "CLI",
			})

			return c.json({ apiKey: key.value })
		},
	)

// ── Web AuthKit: login, callback, logout ──

const webAuth = new Hono<{ Bindings: Cloudflare.Env }>()
	.get("/login", async c => {
		const returnTo = c.req.query("returnTo")
		const screenHint =
			c.req.query("screenHint") === "sign-in" ? "sign-in" : undefined
		console.log(
			"webAuth login",
			c.env.WORKOS_API_KEY,
			c.env.WORKOS_CLIENT_ID,
			c.env.WORKOS_REDIRECT_URI,
		)
		const workos = new WorkOS(c.env.WORKOS_API_KEY, {
			clientId: c.env.WORKOS_CLIENT_ID,
		})

		const state = returnTo ? btoa(JSON.stringify({ returnTo })) : undefined

		const authorizationUrl = workos.userManagement.getAuthorizationUrl({
			provider: "authkit",
			redirectUri: c.env.WORKOS_REDIRECT_URI,
			clientId: c.env.WORKOS_CLIENT_ID,
			state,
			screenHint,
		})

		return c.redirect(authorizationUrl)
	})
	.get("/callback", async c => {
		const code = c.req.query("code")
		if (!code) {
			return c.json({ error: "No code provided" }, 400)
		}

		const workos = new WorkOS(c.env.WORKOS_API_KEY, {
			clientId: c.env.WORKOS_CLIENT_ID,
		})

		try {
			const authenticateResponse =
				await workos.userManagement.authenticateWithCode({
					clientId: c.env.WORKOS_CLIENT_ID,
					code,
					session: {
						sealSession: true,
						cookiePassword: c.env.WORKOS_COOKIE_PASSWORD,
					},
				})

			const { user, sealedSession } = authenticateResponse

			if (!sealedSession) {
				return c.json({ error: "Failed to create session" }, 500)
			}

			const db = createDbFromUrl(c.env.HYPERDRIVE.connectionString)

			// Store GitHub token if available from OAuth
			const githubToken = authenticateResponse.oauthTokens?.accessToken
			if (githubToken) {
				console.log("Successfully fetched GitHub tokens")
				await db
					.insert(githubOauthTokens)
					.values({
						userId: user.id,
						accessToken: githubToken,
						scopes: [],
					})
					.onConflictDoUpdate({
						target: githubOauthTokens.userId,
						set: { accessToken: githubToken },
					})
			} else {
				console.warn("WARNING: No Github tokens found!")
			}

			// Ensure user has a personal organization
			await ensurePersonalOrganization(workos, db, user.id, user.email)

			setCookie(c, "wos-session", sealedSession, {
				path: "/",
				httpOnly: true,
				secure: true,
				sameSite: "Lax",
				maxAge: 60 * 60 * 24 * 30,
			})

			return c.redirect("/")
		} catch (err) {
			console.error("auth callback error:", err)
			return c.json({ error: "auth_failed", details: String(err) }, 500)
		}
	})
	.get("/logout", async c => {
		const returnTo = c.req.query("returnTo")
		const workos = new WorkOS(c.env.WORKOS_API_KEY, {
			clientId: c.env.WORKOS_CLIENT_ID,
		})

		try {
			const session = workos.userManagement.loadSealedSession({
				sessionData: getCookie(c, "wos-session") ?? "",
				cookiePassword: c.env.WORKOS_COOKIE_PASSWORD,
			})

			const url = await session.getLogoutUrl({
				returnTo,
			})
			deleteCookie(c, "wos-session", {
				path: "/",
				httpOnly: true,
				secure: true,
				sameSite: "Lax",
			})
			return c.redirect(url)
		} catch {
			deleteCookie(c, "wos-session", {
				path: "/",
				httpOnly: true,
				secure: true,
				sameSite: "Lax",
			})
			return c.redirect(returnTo ?? "/")
		}
	})
	.get("/", async c => {
		console.log("auth check")
		return c.json({ ok: true })
	})
	.get("/session", async c => {
		const sessionData = getCookie(c, "wos-session") ?? ""
		if (!sessionData) {
			return c.json({ error: "Unauthorized" }, 401)
		}

		const workos = new WorkOS(c.env.WORKOS_API_KEY, {
			clientId: c.env.WORKOS_CLIENT_ID,
		})

		const session = workos.userManagement.loadSealedSession({
			sessionData,
			cookiePassword: c.env.WORKOS_COOKIE_PASSWORD,
		})

		const authResult = await session.authenticate()

		if (authResult.authenticated) {
			return c.json({
				user: {
					id: authResult.user.id,
					firstName: authResult.user.firstName,
					lastName: authResult.user.lastName,
					email: authResult.user.email,
				},
				accessToken: authResult.accessToken,
				apiUrl: c.env.VITE_FLAMECAST_API_URL || "https://api.flamecast.dev",
			})
		}

		// Session expired — attempt refresh
		try {
			const refreshResult = await session.refresh()
			if (!refreshResult.authenticated || !refreshResult.sealedSession) {
				return c.json({ error: "Unauthorized" }, 401)
			}

			setCookie(c, "wos-session", refreshResult.sealedSession, {
				path: "/",
				httpOnly: true,
				secure: true,
				sameSite: "Lax",
				maxAge: 60 * 60 * 24 * 30,
			})

			// Re-authenticate the refreshed session to get an access token
			const refreshedSession = workos.userManagement.loadSealedSession({
				sessionData: refreshResult.sealedSession,
				cookiePassword: c.env.WORKOS_COOKIE_PASSWORD,
			})
			const newAuth = await refreshedSession.authenticate()
			if (!newAuth.authenticated) {
				return c.json({ error: "Unauthorized" }, 401)
			}

			return c.json({
				user: {
					id: newAuth.user.id,
					firstName: newAuth.user.firstName,
					lastName: newAuth.user.lastName,
					email: newAuth.user.email,
				},
				accessToken: newAuth.accessToken,
				apiUrl: c.env.VITE_FLAMECAST_API_URL || "https://api.flamecast.dev",
			})
		} catch {
			return c.json({ error: "Unauthorized" }, 401)
		}
	})

const TokenRefreshSchema = z.object({
	refreshToken: z.string(),
})

const tokenRefresh = new Hono<{ Bindings: Cloudflare.Env }>().post(
	"/",
	zValidator("json", TokenRefreshSchema),
	async c => {
		const { refreshToken } = c.req.valid("json")

		const workos = new WorkOS(c.env.WORKOS_API_KEY, {
			clientId: c.env.WORKOS_CLIENT_ID,
		})

		try {
			const result = await workos.userManagement.authenticateWithRefreshToken({
				refreshToken,
				clientId: c.env.WORKOS_CLIENT_ID,
			})

			return c.json({
				accessToken: result.accessToken,
				refreshToken: result.refreshToken,
			})
		} catch {
			return c.json({ error: "Invalid or expired refresh token" }, 401)
		}
	},
)

auth.route("/", webAuth)
auth.route("/refresh", tokenRefresh)

export default auth
