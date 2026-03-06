import {
	SanityCheckResponseSchema,
	type SanityCheckResponse,
} from "backend/contracts"
import { hc } from "hono/client"
import type { Hono } from "hono"

export const backendUrl =
	process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:6970"
type BackendRPC = Hono<
	{
		Bindings: Record<string, unknown>
	},
	{
		"/api/sanity": {
			$get: {
				input: { query?: string }
				output: SanityCheckResponse
				outputFormat: "json"
				status: 200
			}
		}
	}
>
const backendClient = hc<BackendRPC>(`${backendUrl}`)

export async function checkBackendSanity(): Promise<SanityCheckResponse> {
	const response = await backendClient.api.sanity.$get()
	if (!response.ok) {
		throw new Error(`Sanity check failed with status ${response.status}`)
	}

	const json = await response.json()
	return SanityCheckResponseSchema.parse(json)
}
