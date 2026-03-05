import { createContext, useContext, useMemo, useRef } from "react"
import { useAuth } from "./auth-context"
import { createApiClient } from "./api"
import type Flamecast from "@flamecast/api"

const ApiClientContext = createContext<Flamecast | null>(null)

export function ApiClientProvider({ children }: { children: React.ReactNode }) {
	const { getAccessToken, refreshSession, apiUrl } = useAuth()
	const token = getAccessToken()
	const refreshSessionRef = useRef(refreshSession)
	refreshSessionRef.current = refreshSession

	const client = useMemo(() => {
		if (!token) return null

		const fetchWithRefresh: typeof globalThis.fetch = async (input, init) => {
			const res = await globalThis.fetch(input, init)
			if (res.status !== 401) return res

			const newToken = await refreshSessionRef.current()
			if (!newToken) return res

			const newInit = { ...init, headers: { ...Object(init?.headers) } }
			;(newInit.headers as Record<string, string>).Authorization =
				`Bearer ${newToken}`
			return globalThis.fetch(input, newInit)
		}

		return createApiClient(token, apiUrl, fetchWithRefresh)
	}, [token, apiUrl])

	return (
		<ApiClientContext.Provider value={client}>
			{children}
		</ApiClientContext.Provider>
	)
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApiClientOrNull(): Flamecast | null {
	return useContext(ApiClientContext)
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApiClient(): Flamecast {
	const client = useContext(ApiClientContext)
	if (!client)
		throw new Error("useApiClient must be used within ApiClientProvider")
	return client
}
