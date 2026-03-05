import { z } from "zod"

export const ChatMessageSchema = z.record(z.string(), z.unknown())
export const ChatRequestSchema = z.object({
	messages: z.array(ChatMessageSchema).optional(),
})

export const SanityCheckResponseSchema = z.object({
	status: z.literal("ok"),
	service: z.string(),
	timestamp: z.string(),
})

export type ChatRequest = z.infer<typeof ChatRequestSchema>
export type SanityCheckResponse = z.infer<typeof SanityCheckResponseSchema>
