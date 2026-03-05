import { Hono } from "hono"
import { generateSpecs } from "hono-openapi"
import { injectSchemas } from "@flamecast/utils/openapi"
import { allSchemas } from "@flamecast/api-schemas"
import type { Bindings } from "./index"
import { swaggerUI } from "@hono/swagger-ui"

export const openAPIDocumentation = {
	info: {
		title: "Flamecast API",
		version: "2.0.0",
		description:
			"API for managing Flamecast workspaces, tasks, and agent interactivity.",
	},
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http" as const,
				scheme: "bearer",
				description: "Flamecast API key as Bearer token",
			},
		},
	},
	security: [{ bearerAuth: [] }],
	tags: [
		{
			name: "workspaces",
			description: "Create and manage Flamecast workspaces",
		},
		{
			name: "tasks",
			description: "Create, monitor, and interact with tasks",
		},
		{
			name: "github",
			description: "GitHub repository and workflow operations",
		},
		{
			name: "setup",
			description: "Setup status and configuration checks",
		},
	],
}

export function createOpenAPIRoute(app: Hono<{ Bindings: Bindings }>) {
	const openAPIApp = new Hono<{ Bindings: Bindings }>()

	openAPIApp.get("/", async c => {
		const spec = await generateSpecs(app, {
			documentation: openAPIDocumentation,
		})

		injectSchemas(spec as Record<string, unknown>, allSchemas)

		return c.json(spec)
	})

	// Use the middleware to serve Swagger UI at /ui
	openAPIApp.get("/ui", swaggerUI({ url: "/openapi" }))

	return openAPIApp
}
