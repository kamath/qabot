import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { PostHogProvider } from "@posthog/react"
import { ThemeProvider } from "next-themes"
import { AuthProvider } from "./lib/auth-context"
import { ApiClientProvider, useApiClientOrNull } from "./lib/api-context"
import { routeTree } from "./routeTree.gen"

const router = createRouter({
	routeTree,
	context: {
		apiClient: undefined!,
		queryClient: undefined!,
	},
})

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router
	}
}

import { Toaster } from "@/components/ui/sonner"
import "./index.css"

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			refetchOnWindowFocus: true,
		},
	},
})

function InnerApp() {
	const apiClient = useApiClientOrNull()
	return (
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} context={{ apiClient, queryClient }} />
		</QueryClientProvider>
	)
}

const posthogOptions = {
	api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<PostHogProvider
			apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
			options={posthogOptions}
		>
			<ThemeProvider
				attribute="class"
				defaultTheme="light"
				storageKey="flamecast-theme"
			>
				<AuthProvider>
					<ApiClientProvider>
						<InnerApp />
					</ApiClientProvider>
				</AuthProvider>
				<Toaster />
			</ThemeProvider>
		</PostHogProvider>
	</StrictMode>,
)
