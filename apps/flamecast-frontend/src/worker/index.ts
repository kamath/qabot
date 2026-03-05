import { Hono } from "hono"
import example from "./routes/example"
import auth from "./routes/auth"
import githubSearch from "./routes/github-search"

const app = new Hono<{ Bindings: Cloudflare.Env }>()
	.route("/api", example)
	.route("/auth", auth)
	.route("/github", githubSearch)

export type AppType = typeof app

export default app
