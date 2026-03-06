import { Hono } from "hono"
import { swaggerUI } from "@hono/swagger-ui"
import { openAPIRouteHandler } from "hono-openapi"
import { chatRoute } from "./routes/chat"
import { sanityRoute } from "./routes/sanity"

const CORS_HEADERS = {
	"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	"Access-Control-Allow-Headers":
		"Content-Type, Authorization, User-Agent, X-Stainless-Lang, X-Stainless-Package-Version, X-Stainless-OS, X-Stainless-Arch, X-Stainless-Runtime, X-Stainless-Runtime-Version, X-Stainless-Retry-Count, X-Stainless-Timeout",
	"Access-Control-Allow-Credentials": "true",
	"Access-Control-Max-Age": "86400",
}

export type Bindings = Record<string, unknown>

function withCors(request: Request, response: Response): Response {
	const origin = request.headers.get("origin") ?? "*"
	const corsResponse = new Response(response.body, response)
	corsResponse.headers.set("Access-Control-Allow-Origin", origin)
	for (const [k, v] of Object.entries(CORS_HEADERS)) {
		corsResponse.headers.set(k, v)
	}
	return corsResponse
}

const base = new Hono<{ Bindings: Bindings }>()
const openApiSpecHandler = openAPIRouteHandler(base, {
	includeEmptyPaths: true,
	documentation: {
		info: {
			title: "Backend API",
			version: "1.0.0",
		},
	},
})

const app = base
	.get("/openapi", openApiSpecHandler)
	.get(
		"/openapi/ui",
		swaggerUI({
			url: "/openapi",
		}),
	)
	.route("/", sanityRoute)
	.route("/", chatRoute)

export type AppType = typeof app

export { app, openApiSpecHandler }

export default {
	async fetch(request: Request, env: Bindings): Promise<Response> {
		const origin = request.headers.get("origin") ?? "*"

		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					"Access-Control-Allow-Origin": origin,
					...CORS_HEADERS,
				},
			})
		}

		const response = await app.fetch(request, env)
		return withCors(request, response)
	},
}
