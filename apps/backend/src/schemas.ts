import { z } from "zod"

export const SanityCheckResponseSchema = z.object({
	status: z.literal("ok"),
	service: z.string(),
	timestamp: z.string(),
})

export type SanityCheckResponse = z.infer<typeof SanityCheckResponseSchema>
