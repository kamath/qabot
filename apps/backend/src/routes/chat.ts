import { Hono } from "hono"
import { convertToModelMessages, streamText, type ToolSet } from "ai"
import { ChatRequestSchema } from "../schemas"

const chat = new Hono()
type LegacyMessages = Parameters<typeof convertToModelMessages>[0]

const fallbackMessages = [
	{
		role: "user",
		parts: [{ type: "text", text: "Write a simple Hello World program" }],
	},
] as LegacyMessages

chat.post("/chat", async c => {
	const body = await c.req.json().catch(() => ({}))
	const parsedBody = ChatRequestSchema.safeParse(body)
	const messages =
		parsedBody.success && parsedBody.data.messages
			? (parsedBody.data.messages as LegacyMessages)
			: fallbackMessages
	const modelMessages = await convertToModelMessages(messages)

	const { createACPProvider } = await import("@mcpc-tech/acp-ai-provider")
	const provider = createACPProvider({
		command: "codex-acp",
		args: [],
		session: {
			cwd: process.cwd(),
			mcpServers: [],
		},
	})

	const result = streamText({
		model: provider.languageModel(),
		system: "You are a helpful assistant.",
		messages: modelMessages,
		tools: provider.tools as unknown as ToolSet,
	})

	return result.toUIMessageStreamResponse()
})

export default chat
