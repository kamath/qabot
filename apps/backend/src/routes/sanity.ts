import { describeRoute, resolver } from "hono-openapi"
import { Hono } from "hono"
import { SanityCheckResponseSchema } from "../schemas"
import type { AppEnv } from "../env"

export const sanityRoute = new Hono<AppEnv>().get(
	"/api/sanity",
	describeRoute({
		summary: "Sanity check",
		description: "Returns backend health information.",
		responses: {
			200: {
				description: "Backend is healthy",
				content: {
					"application/json": {
						schema: resolver(SanityCheckResponseSchema),
					},
				},
			},
		},
	}),
	async (c) => {
		const response = SanityCheckResponseSchema.parse({
			status: "ok",
			service: "backend",
			timestamp: new Date().toISOString(),
		})

		return c.json(response)
	},
)
