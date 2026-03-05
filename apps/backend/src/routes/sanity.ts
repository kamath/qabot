import { Hono } from "hono"
import { SanityCheckResponseSchema } from "@flamecast/backend-schemas"

const sanity = new Hono()

sanity.get("/sanity", c => {
	const response = SanityCheckResponseSchema.parse({
		status: "ok",
		service: "backend",
		timestamp: new Date().toISOString(),
	})

	return c.json(response)
})

export default sanity
