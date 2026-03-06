import { createACPProvider } from "@mcpc-tech/acp-ai-provider"
import { convertToModelMessages, streamText } from "ai"
import type { UIMessage } from "ai"
import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import { z } from "zod"

const chat = new Hono()

const provider = createACPProvider({
	command: "codex-acp",
	args: [],
	session: {
		cwd: process.cwd(),
		mcpServers: [],
	},
})
const ChatStreamSchema = z.string()

chat.post(
	"/chat",
	describeRoute({
		summary: "Chat completion stream",
		description: "Proxies a chat stream from the configured AI provider.",
		responses: {
			200: {
				description: "Server-Sent Events stream",
				content: {
					"text/event-stream": {
						schema: resolver(ChatStreamSchema),
					},
				},
			},
		},
	}),
	async c => {
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
	},
)

export default chat
