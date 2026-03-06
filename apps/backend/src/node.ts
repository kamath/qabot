import { serve } from "@hono/node-server"
import backend from "./index"

const requestedPort = Number.parseInt(process.env.PORT ?? "6970", 10)
const port = Number.isFinite(requestedPort) ? requestedPort : 6970

serve({
	fetch: backend.fetch,
	port,
})

console.log(`Hono server running at http://localhost:${port}`)
