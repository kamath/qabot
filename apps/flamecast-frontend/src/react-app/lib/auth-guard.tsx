import { useAuth } from "./auth-context"
import { useEffect } from "react"
import { LoadingScreen } from "@/components/loading-screen"

export function RequireAuth({ children }: { children: React.ReactNode }) {
	const { isLoading, user, signIn } = useAuth()

	useEffect(() => {
		if (isLoading || user) {
			return
		}
		signIn()
	}, [isLoading, user, signIn])

	if (isLoading || !user) {
		return <LoadingScreen />
	}

	return <>{children}</>
}
