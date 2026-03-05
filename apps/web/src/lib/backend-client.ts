import { hc } from "hono/client"
import type { AppType } from "../../../backend/src/index"
import {
	type SanityCheckResponse,
	SanityCheckResponseSchema,
} from "@flamecast/backend-schemas"

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:6970"

export const backendClient = hc<AppType>(backendUrl || "http://localhost:6970")

export async function checkBackendSanity(): Promise<SanityCheckResponse> {
	const response = await backendClient.api.sanity.$get()
	if (!response.ok) {
		throw new Error(`Sanity check failed with status ${response.status}`)
	}

	const json = await response.json()
	return SanityCheckResponseSchema.parse(json)
}
