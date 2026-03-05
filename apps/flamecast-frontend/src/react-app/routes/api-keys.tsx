import { createFileRoute } from "@tanstack/react-router"
import { RequireAuth } from "../lib/auth-guard"
import { ApiKeysPage } from "../pages/api-keys-page"

export const Route = createFileRoute("/api-keys")({
	component: () => (
		<RequireAuth>
			<ApiKeysPage />
		</RequireAuth>
	),
})
