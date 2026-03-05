import { Hono } from "hono"

const example = new Hono<{ Bindings: Cloudflare.Env }>().get("/", c =>
	c.json({ name: "Cloudflare" }),
)

export default example
