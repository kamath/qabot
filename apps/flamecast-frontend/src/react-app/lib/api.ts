import Flamecast from "@flamecast/api"

export function createApiClient(
	accessToken: string,
	baseURL: string,
	fetch?: typeof globalThis.fetch,
): Flamecast {
	return new Flamecast({
		apiKey: accessToken,
		baseURL,
		fetch,
	})
}
