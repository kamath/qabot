import * as p from "@clack/prompts"
import { clearConfig } from "../lib/config.js"

export async function handleLogout() {
	clearConfig()
	p.log.success("Logged out")
}
