import { createACPProvider } from "@mcpc-tech/acp-ai-provider"
import { convertToModelMessages, streamText } from "ai"
import type { ToolSet, UIMessage } from "ai"
import { Hono } from "hono"

const chat = new Hono()

const provider = createACPProvider({
	command: "codex-acp",
	args: [],
	session: {
		cwd: process.cwd(),
		mcpServers: [],
	},
})

chat.post("/chat", async c => {
	const body = await c.req.json().catch(() => ({}))
	// biome-ignore lint: plugin-enforced assertion is intentional here
	const messages = body.messages as UIMessage[]
	const modelMessages = await convertToModelMessages(messages)

	const result = streamText({
		model: provider.languageModel(),
		system: "You are a helpful assistant.",
		messages: modelMessages,
	})

	return result.toUIMessageStreamResponse()
})

export default chat
