import { createRootRouteWithContext } from "@tanstack/react-router"
import type { RouterContext } from "../lib/router-context"
import { RootLayout } from "../layouts/root-layout"

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootLayout,
})
