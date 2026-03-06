import { createACPProvider } from "@mcpc-tech/acp-ai-provider"
import { convertToModelMessages, streamText } from "ai"
import type { UIMessage } from "ai"
import { describeRoute, resolver, validator } from "hono-openapi"
import { Hono } from "hono"
import type { AppEnv } from "../env"
import { z } from "zod"

const provider = createACPProvider({
	command: "codex-acp",
	args: [],
	session: {
		cwd: process.cwd(),
		mcpServers: [],
	},
})
const ChatRequestSchema = z.object({
	messages: z.array(z.unknown()),
})
const ChatStreamSchema = z.string()

export const chatRoute = new Hono<AppEnv>().post(
	"/api/chat",
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
	validator("json", ChatRequestSchema),
	async (c) => {
		const body = c.req.valid("json")
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
