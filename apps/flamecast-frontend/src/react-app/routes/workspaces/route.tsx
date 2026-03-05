import { createFileRoute, Outlet } from "@tanstack/react-router"
import { RequireAuth } from "../../lib/auth-guard"

export const Route = createFileRoute("/workspaces")({
	component: () => (
		<RequireAuth>
			<Outlet />
		</RequireAuth>
	),
})
