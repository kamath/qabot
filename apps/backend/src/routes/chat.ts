import { createACPProvider } from "@mcpc-tech/acp-ai-provider"
import { convertToModelMessages, streamText, type ToolSet } from "ai"
import { Hono } from "hono"
import { ChatRequestSchema } from "@flamecast/backend-schemas"

const provider = createACPProvider({
	command: "codex-acp",
	args: [],
	session: {
		cwd: process.cwd(),
		mcpServers: [],
	},
})

const chat = new Hono()

chat.post("/chat", async c => {
	const body = await c.req.json().catch(() => ({}))
	const parsedBody = ChatRequestSchema.safeParse(body)
	const messages =
		parsedBody.success && parsedBody.data.messages
			? parsedBody.data.messages
			: [
				{
					role: "user",
					content: "Write a simple Hello World program",
				},
			]

	const result = streamText({
		model: provider.languageModel(),
		system: "You are a helpful assistant.",
		messages: convertToModelMessages(messages),
		tools: provider.tools as unknown as ToolSet,
	})

	return result.toUIMessageStreamResponse()
})

export default chat
