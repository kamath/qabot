import { Hono } from "hono"
import {
	convertToModelMessages,
	streamText,
	type UIMessage,
	type ToolSet,
} from "ai"
import { ChatRequestSchema } from "../schemas"

const chat = new Hono()
type LegacyMessage = Omit<UIMessage<unknown, unknown, unknown>, "id">

const fallbackMessage: LegacyMessage[] = [
	{
		role: "user",
		parts: [{ type: "text", text: "Write a simple Hello World program" }],
	},
]

chat.post("/chat", async c => {
	const body = await c.req.json().catch(() => ({}))
	const parsedBody = ChatRequestSchema.safeParse(body)
	const messages: LegacyMessage[] =
		parsedBody.success && parsedBody.data.messages
			? (parsedBody.data.messages as LegacyMessage[])
			: fallbackMessage
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
