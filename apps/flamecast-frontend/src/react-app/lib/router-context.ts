import type Flamecast from "@flamecast/api"
import type { QueryClient } from "@tanstack/react-query"

export interface RouterContext {
	apiClient: Flamecast | null
	queryClient: QueryClient
}
