import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react"

interface AuthUser {
	id: string
	firstName: string | null
	lastName: string | null
	email: string
}

interface AuthContextValue {
	isLoading: boolean
	user: AuthUser | null
	signIn: () => void
	signOut: () => void
	getAccessToken: () => string | null
	refreshSession: () => Promise<string | null>
	apiUrl: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [isLoading, setIsLoading] = useState(true)
	const [user, setUser] = useState<AuthUser | null>(null)
	const [accessToken, setAccessToken] = useState<string | null>(null)
	const [apiUrl, setApiUrl] = useState("https://api.flamecast.dev")
	const refreshPromiseRef = useRef<Promise<string | null> | null>(null)

	const fetchSession = useCallback(async (): Promise<string | null> => {
		try {
			const res = await fetch("/auth/session", {
				credentials: "include",
				cache: "no-store",
			})
			if (!res.ok) {
				setUser(null)
				setAccessToken(null)
				return null
			}
			const data = (await res.json()) as {
				user: AuthUser
				accessToken: string | null
				apiUrl?: string
			}
			setUser(data.user)
			setAccessToken(data.accessToken)
			if (data.apiUrl) setApiUrl(data.apiUrl)
			return data.accessToken as string | null
		} catch {
			setUser(null)
			setAccessToken(null)
			return null
		}
	}, [])

	useEffect(() => {
		fetchSession().finally(() => setIsLoading(false))
	}, [fetchSession])

	const signIn = useCallback(() => {
		window.location.href = "/auth/login"
	}, [])

	const signOut = useCallback(() => {
		window.location.href = "/auth/logout"
	}, [])

	const getAccessToken = useCallback(() => accessToken, [accessToken])

	const refreshSession = useCallback(async (): Promise<string | null> => {
		// Deduplicate concurrent refresh calls
		if (refreshPromiseRef.current) return refreshPromiseRef.current
		refreshPromiseRef.current = fetchSession().finally(() => {
			refreshPromiseRef.current = null
		})
		return refreshPromiseRef.current
	}, [fetchSession])

	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				refreshSession()
			}
		}
		document.addEventListener("visibilitychange", handleVisibilityChange)
		return () =>
			document.removeEventListener("visibilitychange", handleVisibilityChange)
	}, [refreshSession])

	return (
		<AuthContext.Provider
			value={{
				isLoading,
				user,
				signIn,
				signOut,
				getAccessToken,
				refreshSession,
				apiUrl,
			}}
		>
			{children}
		</AuthContext.Provider>
	)
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error("useAuth must be used within AuthProvider")
	return ctx
}
