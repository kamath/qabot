import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import { SanityCheckResponseSchema } from "../schemas"

const sanity = new Hono()

sanity.get(
	"/sanity",
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
	c => {
		const response = SanityCheckResponseSchema.parse({
			status: "ok",
			service: "backend",
			timestamp: new Date().toISOString(),
		})

		return c.json(response)
	},
)

export default sanity
