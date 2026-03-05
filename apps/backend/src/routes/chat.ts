import { createACPProvider } from "@mcpc-tech/acp-ai-provider"
import { convertToModelMessages, streamText } from "ai"
import { Hono } from "hono"
import { ChatRequestSchema } from "../schemas"

const chat = new Hono()
type MessagesArg = Parameters<typeof convertToModelMessages>[0]

const fallbackMessages: MessagesArg = [
	{
		role: "user",
		parts: [{ type: "text", text: "Write a simple Hello World program" }],
	},
]

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
	const parsedBody = ChatRequestSchema.safeParse(body)
	const messages =
		parsedBody.success && parsedBody.data.messages
			? parsedBody.data.messages
			: fallbackMessages
	const modelMessages = await convertToModelMessages(messages)

	const result = streamText({
		model: provider.languageModel(),
		system: "You are a helpful assistant.",
		messages: modelMessages,
		tools: provider.tools,
	})

	return result.toUIMessageStreamResponse()
})

export default chat
