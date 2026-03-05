import { Hono } from "hono"
import { getCookie } from "hono/cookie"
import { WorkOS } from "@workos-inc/node"
import auth from "./routes/auth"
import githubRepos from "./routes/github-repos"
import setup from "./routes/setup"
import workspaces from "./routes/workspaces"
import apiKeys from "./routes/api-keys"
import email from "./routes/email"
import { createOpenAPIRoute } from "./openapi"

export type Bindings = {
	WORKOS_API_KEY: string
	WORKOS_CLIENT_ID: string
	WORKOS_COOKIE_PASSWORD: string
	WORKOS_REDIRECT_URI: string
	HYPERDRIVE: Hyperdrive
	POSTHOG_KEY: string
	POSTHOG_HOST: string
	SMITHERY_API_KEY: string
	AGENTMAIL_API_KEY: string
	AGENTMAIL_INBOX_ID: string
}

const CORS_HEADERS = {
	"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	"Access-Control-Allow-Headers":
		"Content-Type, Authorization, User-Agent, X-Stainless-Lang, X-Stainless-Package-Version, X-Stainless-OS, X-Stainless-Arch, X-Stainless-Runtime, X-Stainless-Runtime-Version, X-Stainless-Retry-Count, X-Stainless-Timeout",
	"Access-Control-Allow-Credentials": "true",
	"Access-Control-Max-Age": "86400",
}

function withCors(request: Request, response: Response): Response {
	const origin = request.headers.get("origin") ?? "*"
	const corsResponse = new Response(response.body, response)
	corsResponse.headers.set("Access-Control-Allow-Origin", origin)
	for (const [k, v] of Object.entries(CORS_HEADERS)) {
		corsResponse.headers.set(k, v)
	}
	return corsResponse
}

const app = new Hono<{ Bindings: Bindings }>()
	.route("/auth", auth)
	.route("/github", githubRepos)
	.route("/setup", setup)
	.route("/workspaces", workspaces)
	.route("/api-keys", apiKeys)
	.route("/email", email)
	.get("/", async c => {
		let user = null

		try {
			const workos = new WorkOS(c.env.WORKOS_API_KEY, {
				clientId: c.env.WORKOS_CLIENT_ID,
			})

			const session = workos.userManagement.loadSealedSession({
				sessionData: getCookie(c, "wos-session") ?? "",
				cookiePassword: c.env.WORKOS_COOKIE_PASSWORD,
			})

			const authResult = await session.authenticate()
			if (authResult.authenticated) {
				user = authResult.user
			}
		} catch (_e) {
			// Not authenticated, user stays null
		}

		if (user) {
			return c.text(`Welcome, ${user.email}!`)
		}

		return c.text("Hello Hono!")
	})

export type AppType = typeof app

// OpenAPI route added after type export (not needed in RPC client)
app.route("/openapi", createOpenAPIRoute(app))

// Re-export the Hono app for scripts (e.g. openapi generation)
export { app }

// Default export wraps with CORS at the fetch level to guarantee headers on every response
export default {
	async fetch(
		request: Request,
		env: Bindings,
		ctx: ExecutionContext,
	): Promise<Response> {
		const origin = request.headers.get("origin") ?? "*"

		// Handle preflight
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					"Access-Control-Allow-Origin": origin,
					...CORS_HEADERS,
				},
			})
		}

		const response = await app.fetch(request, env, ctx)
		return withCors(request, response)
	},
}
