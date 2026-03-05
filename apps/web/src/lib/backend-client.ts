import { hc } from "hono/client"
import {
	type AppType,
	SanityCheckResponseSchema,
	type SanityCheckResponse,
} from "backend/contracts"

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:6970"

export const backendClient = hc<AppType>(backendUrl)

export async function checkBackendSanity(): Promise<SanityCheckResponse> {
	const response = await backendClient.api.sanity.$get()
	if (!response.ok) {
		throw new Error(`Sanity check failed with status ${response.status}`)
	}

	const json = await response.json()
	return SanityCheckResponseSchema.parse(json)
}
