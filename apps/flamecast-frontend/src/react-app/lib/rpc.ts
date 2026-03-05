import { hc } from "hono/client"
import type { AppType } from "../../worker"

export const client = hc<AppType>("/")
