import { createFileRoute } from "@tanstack/react-router"
import { NewWorkspacePage } from "../../pages/new-workspace-page"

type NewWorkspaceSearch = {
	template?: string
}

export const Route = createFileRoute("/workspaces/new")({
	validateSearch: (search: Record<string, unknown>): NewWorkspaceSearch => {
		return {
			template:
				typeof search.template === "string" ? search.template : undefined,
		}
	},
	component: NewWorkspacePage,
})
